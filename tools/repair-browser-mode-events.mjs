#!/usr/bin/env node
/**
 * repair-browser-mode-events.mjs — reopen Sessions that pwbrowser-bundle
 * v1.3.0 locked.
 *
 * v1.3.0 appended a `browser/mode` Session event. That type is not in the
 * host's `KNOWN_SESSION_EVENT_TYPES` and the event carried no `ignorable: true`
 * marker, so the host refuses to interpret the whole log:
 *
 *   failed to observe session "…": session contains event type "browser/mode"
 *   (seq 9244) unknown to this harness and not marked ignorable
 *
 * The Session is intact — only those few events need the marker. This tool
 * rewrites exactly the zstd frames that hold a `browser/mode` event, adding
 * `ignorable: true` and re-compressing them with the same checksum flag the
 * host writes; every other frame keeps its original bytes. Session sequence
 * numbers, ids, and every other event are untouched.
 *
 * Usage (Node 18+, no dependencies):
 *
 *   node repair-browser-mode-events.mjs                 # report only (dry run)
 *   node repair-browser-mode-events.mjs --apply         # patch, with backups
 *   node repair-browser-mode-events.mjs --sessions DIR  # another sessions root
 *   node repair-browser-mode-events.mjs --apply --out DIR
 *
 * Close DSH (or at least do not open the affected Sessions) while `--apply`
 * runs: the host holds its own writer for a Session it has open.
 *
 * @module @local/pwbrowser-browsers/tools
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib'

/** The event type v1.3.0 wrote, and the only type this tool rewrites. */
const TARGET = 'browser/mode'

/** zstd frame magic (little endian). */
const MAGIC = 0xFD2FB528

/** The Session format this tool understands; anything else is reported, not touched. */
const LOG_NAME = 'session.v4.jsonl.zstd'

/** Envelope keys a stored event may carry; anything else is a format surprise. */
const ALLOWED_KEYS = new Set(['type', 'seq', 'time', 'data', 'surfaceOp', 'sourceEventSeqs', 'ignorable'])

/**
 * Types the host knows. Used only to *warn* about other unknown events; this
 * tool never rewrites anything but {@link TARGET}.
 */
const KNOWN_TYPES = new Set(`agent-preset/selected,agent/inbox/spliced,approval/asked,approval/decided,approval/policy,assistant/attempt,assistant/message,command/done,command/run,compaction/end,compaction/prune,compaction/start,compaction/summary,deliverables/presented,developer/message,feedback/message-delete,feedback/message-put,feedback/record,goal/change,hook/invoked,hook/result,image/offload,job/registered,job/settled,llm/retry,llm/retry-started,model/selection,permission/preset,plan/mode,request/context,request/header,sandbox/mode,schedule/change,session-log-deepseek/delivery-accepted,session/end-seed,session/title,session/title-llm-request,step/end,step/start,subagent/catalog,subagent/descriptor,subagent/model-selection-policy,system/message,team/member,team/message/delivered,team/message/queued,team/mode,team/task,todo/write,tool-workflow/agent-end,tool-workflow/agent-start,tool-workflow/run-end,tool-workflow/run-start,tool/call,tool/ptc-dispatch,tool/ptc-dispatch-start,tool/result,turn/end,turn/start,user/message,web/deepseek-search-llm-request,working-directory/change,workspace/changes`.split(','))

/** Parse the command line. */
function parseArgs(argv) {
  const options = { apply: false, sessions: join(homedir(), '.dsh', 'sessions'), out: undefined }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--apply') options.apply = true
    else if (arg === '--dry-run') options.apply = false
    else if (arg === '--sessions') options.sessions = resolve(argv[(i += 1)])
    else if (arg === '--out') options.out = resolve(argv[(i += 1)])
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return options
}

/**
 * Split a v4 Session log into its zstd frames.
 *
 * The log is an append-only concatenation of independently compressed frames,
 * so a single `zstdDecompress` only yields the first one. Frames are located by
 * walking each frame's header and block table.
 *
 * @param buffer - the whole log file.
 * @returns one `{ start, end }` byte range per frame.
 */
function scanFrames(buffer) {
  const frames = []
  let off = 0
  while (off < buffer.length) {
    const start = off
    if (buffer.length - off < 4) throw new Error(`torn frame header at byte ${off}`)
    if (buffer.readUInt32LE(off) !== MAGIC) throw new Error(`bad frame magic at byte ${off}`)
    off += 4
    const descriptor = buffer.readUInt8(off)
    off += 1
    if ((descriptor & 24) !== 0) throw new Error(`reserved descriptor bit at byte ${off - 1}`)
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    off += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    for (;;) {
      if (buffer.length - off < 3) throw new Error(`torn block header at byte ${off}`)
      const header = buffer.readUIntLE(off, 3)
      off += 3
      const last = (header & 1) !== 0
      const type = (header >>> 1) & 3
      const size = header >>> 3
      if (type === 3) throw new Error(`reserved block type at byte ${off - 3}`)
      off += type === 1 ? 1 : size
      if (last) break
    }
    if (checksum) off += 4
    if (off > buffer.length) throw new Error(`torn frame at byte ${start}`)
    frames.push({ start, end: off })
  }
  return frames
}

/**
 * Decode a log: its header line(s) and every stored event, each tagged with the
 * frame it came from. The very first line of a v4 log is the Session header
 * (`{version, id, cwd, …}`), not an event, so it carries no `seq`.
 */
function decodeLog(buffer, frames) {
  const headers = []
  const events = []
  frames.forEach((frame, index) => {
    const text = zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString('utf8')
    for (const line of text.split('\n')) {
      if (line === '') continue
      const parsed = JSON.parse(line)
      if (typeof parsed.seq === 'number') events.push({ event: parsed, frame: index })
      else headers.push(parsed)
    }
  })
  return { headers, events }
}

/**
 * Rewrite the frames that hold a `browser/mode` event.
 *
 * @param buffer - the log.
 * @param frames - its frames.
 * @param wanted - indexes of the frames to re-encode.
 * @returns the new log bytes.
 */
function rewrite(buffer, frames, wanted) {
  const pieces = []
  frames.forEach((frame, index) => {
    if (!wanted.has(index)) {
      pieces.push(buffer.subarray(frame.start, frame.end))
      return
    }
    const text = zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString('utf8')
    const lines = text.split('\n')
    const out = lines.map((line) => {
      if (line === '') return line
      const event = JSON.parse(line)
      if (event.type !== TARGET || event.ignorable === true) return line
      return JSON.stringify({ ...event, ignorable: true })
    })
    pieces.push(zstdCompressSync(Buffer.from(out.join('\n'), 'utf8'), {
      params: { [constants.ZSTD_c_checksumFlag]: 1 },
    }))
  })
  return Buffer.concat(pieces)
}

/**
 * Check a candidate rewrite against the original: same events, same seqs, same
 * bytes for everything this tool did not touch.
 *
 * @param original - the old log.
 * @param result - the new log.
 * @param expected - how many events should have gained the marker.
 * @returns a list of problems; empty means the rewrite is safe.
 */
function verify(original, result, expected) {
  const problems = []
  const beforeFrames = scanFrames(original)
  const before = decodeLog(original, beforeFrames).events
  const afterFrames = scanFrames(result)
  const afterLog = decodeLog(result, afterFrames)
  const after = afterLog.events
  if (JSON.stringify(decodeLog(original, beforeFrames).headers) !== JSON.stringify(afterLog.headers)) problems.push('session header changed')
  if (before.length !== after.length) problems.push(`event count ${before.length} → ${after.length}`)
  const patched = []
  for (let i = 0; i < Math.min(before.length, after.length); i += 1) {
    const a = before[i].event
    const b = after[i].event
    if (a.seq !== b.seq) { problems.push(`seq ${a.seq} → ${b.seq} at index ${i}`); break }
    if (a.type !== b.type) { problems.push(`type at seq ${a.seq}: ${a.type} → ${b.type}`); break }
    if (a.ignorable !== true && b.ignorable === true) patched.push(a.seq)
    else if (JSON.stringify(a) !== JSON.stringify(b)) { problems.push(`event at seq ${a.seq} changed`); break }
  }
  if (patched.length !== expected) problems.push(`patched ${patched.length} events, expected ${expected}`)
  let gaps = 0
  for (let i = 1; i < after.length; i += 1) if (after[i].event.seq !== after[i - 1].event.seq + 1) gaps += 1
  if (gaps !== 0) problems.push(`${gaps} seq gap(s)`)
  for (const { event } of after) {
    if (Object.keys(event).some((key) => !ALLOWED_KEYS.has(key))) { problems.push(`unexpected envelope key at seq ${event.seq}`); break }
  }
  if (afterFrames.length !== beforeFrames.length) problems.push('frame count changed')
  return problems
}

/** Every Session log below a directory. */
function findLogs(root) {
  const found = []
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { if (entry.name !== '_repair-backups') walk(full) }
      else if (entry.name === LOG_NAME) found.push(full)
    }
  }
  walk(root)
  return found.sort()
}

/**
 * Report, and with `apply` repair, one Session log.
 *
 * @param file - the log path.
 * @param apply - whether to write the repaired log.
 * @param out - where backups go.
 */
function repairOne(file, apply, out) {
  const buffer = readFileSync(file)
  const frames = scanFrames(buffer)
  const { events } = decodeLog(buffer, frames)
  const targets = events.filter(({ event }) => event.type === TARGET && event.ignorable !== true)
  const others = events.filter(({ event }) => !KNOWN_TYPES.has(event.type) && event.ignorable !== true && event.type !== TARGET)
  const head = events[0]?.event
  const report = {
    file,
    session: head?.id ?? basename(dirname(file)),
    bytes: buffer.length,
    frames: frames.length,
    events: events.length,
    locked: targets.length > 0,
    seqs: targets.map(({ event }) => event.seq),
    otherUnknown: others.map(({ event }) => `${event.type}@${event.seq}`),
    applied: false,
  }
  if (targets.length === 0 || !apply) return report

  const wanted = new Set(targets.map(({ frame }) => frame))
  const result = rewrite(buffer, frames, wanted)
  const problems = verify(buffer, result, targets.length)
  if (problems.length > 0) {
    report.error = problems
    return report
  }
  const backupDir = out ?? join(dirname(dirname(resolve(file))), '_repair-backups')
  mkdirSync(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')
  const backup = join(backupDir, `${stamp}-${report.session}.v4.jsonl.zstd.orig`)
  writeFileSync(backup, buffer)
  if (statSync(backup).size !== buffer.length) throw new Error(`backup ${backup} is short`)
  const temp = `${file}.repair-tmp`
  writeFileSync(temp, result)
  renameSync(temp, file)
  report.applied = true
  report.backup = backup
  report.bytesAfter = result.length
  return report
}

const options = parseArgs(process.argv.slice(2))
if (options.help) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n/, ''))
  process.exit(0)
}
if (!existsSync(options.sessions)) {
  console.error(`sessions root not found: ${options.sessions}`)
  process.exit(1)
}

console.log(`sessions root: ${options.sessions}`)
console.log(options.apply ? 'mode: APPLY (backups are written next to the logs)' : 'mode: dry run (add --apply to write)')
const logs = findLogs(options.sessions)
console.log(`session logs: ${logs.length}`)
let locked = 0
let repaired = 0
for (const file of logs) {
  let report
  try {
    report = repairOne(file, options.apply, options.out)
  } catch (error) {
    console.log(`  ! ${basename(dirname(file))}: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }
  if (report.error !== undefined) {
    console.log(`  ! ${report.session}: rewrite rejected: ${report.error.join('; ')}`)
    continue
  }
  if (!report.locked) {
    if (report.otherUnknown.length > 0) console.log(`  ? ${report.session}: other unknown events ${report.otherUnknown.join(', ')}`)
    continue
  }
  locked += 1
  const state = report.applied ? `repaired (${report.seqs.length} events, backup ${report.backup})` : `LOCKED, ${report.seqs.length} event(s) at seq ${report.seqs.join(', ')}`
  console.log(`  ${report.applied ? '✔' : '✖'} ${report.session}: ${state}`)
  if (report.applied) repaired += 1
}
console.log(`\nlocked sessions: ${locked}, repaired now: ${repaired}`)
if (locked > 0 && !options.apply) console.log('run again with --apply to repair them (close DSH first if it has them open)')