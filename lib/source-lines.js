const { constants } = require("node:buffer");
const CHUNK = 32768;

async function transformLines(
  source,
  mode,
  compare,
  { check = () => {}, ending = "\n", random = Math.random } = {},
) {
  let deadline = performance.now() + 4;
  const pause = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    check();
    deadline = performance.now() + 4;
  };
  await pause();
  const count = source.lineCount;
  const IndexArray = count <= 0xffffffff ? Uint32Array : Float64Array;
  let order = new IndexArray(count),
    scratch;
  const startOf = (row) => source.lineStart(row);
  const endOf = (row) => {
    let end = row + 1 < count ? source.lineStart(row + 1) - 1 : source.length;
    if (row + 1 < count && source.charCodeAt(end - 1) === 13) end--;
    return end;
  };
  const lengthOf = (row) => endOf(row) - startOf(row);
  let cachedUnits = 0;
  const cache = new Map();
  const line = (row) => {
    if (cache.has(row)) return cache.get(row);
    const length = lengthOf(row);
    if (length > constants.MAX_STRING_LENGTH)
      throw Object.assign(
        new RangeError(
          "This line exceeds the runtime string limit required by locale/natural collation. Use Sort by Unicode Code Units for an exact source-based order.",
        ),
        { code: "ERR_LINE_COLLATION_LIMIT" },
      );
    const text = source.slice(startOf(row), endOf(row));
    if (length <= CHUNK) {
      while (cache.size >= 2048 || cachedUnits + length > 8 * 1024 * 1024) {
        const oldest = cache.keys().next().value;
        cachedUnits -= cache.get(oldest).length;
        cache.delete(oldest);
      }
      cache.set(row, text);
      cachedUnits += length;
    }
    return text;
  };
  const lexical = (left, right) => {
    if (left === right) return 0;
    const aLength = lengthOf(left),
      bLength = lengthOf(right);
    if (Math.max(aLength, bLength) <= CHUNK) {
      const a = line(left),
        b = line(right);
      return a < b ? -1 : a > b ? 1 : 0;
    }
    return (async () => {
      const aStart = startOf(left),
        bStart = startOf(right),
        length = Math.min(aLength, bLength);
      for (let offset = 0; offset < length; offset += CHUNK) {
        const size = Math.min(CHUNK, length - offset);
        const a = source.slice(aStart + offset, aStart + offset + size),
          b = source.slice(bStart + offset, bStart + offset + size);
        if (a !== b) return a < b ? -1 : 1;
        if (performance.now() >= deadline) await pause();
      }
      return aLength - bLength;
    })();
  };
  const comparator =
    mode === "lexical" || mode === "unique"
      ? lexical
      : mode === "length"
        ? (a, b) => lengthOf(a) - lengthOf(b)
        : (a, b) => compare(line(a), line(b));
  for (let i = 0; i < count; i++) {
    order[i] = mode === "reverse" ? count - i - 1 : i;
    if ((i & 1023) === 0 && performance.now() >= deadline) await pause();
  }
  if (mode === "shuffle") {
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
      if ((i & 1023) === 0 && performance.now() >= deadline) await pause();
    }
  } else if (mode !== "reverse") {
    scratch = new IndexArray(count);
    let comparisons = 0;
    for (let width = 1; width < count; width *= 2) {
      for (let base = 0; base < count; base += width * 2) {
        const middle = Math.min(count, base + width),
          end = Math.min(count, base + width * 2);
        let left = base,
          right = middle,
          out = base;
        while (left < middle && right < end) {
          let result = comparator(order[left], order[right]);
          if (typeof result?.then === "function") result = await result;
          scratch[out++] = result <= 0 ? order[left++] : order[right++];
          if ((++comparisons & 1023) === 0 && performance.now() >= deadline) await pause();
        }
        for (const [from, limit] of [
          [left, middle],
          [right, end],
        ]) {
          for (let offset = from; offset < limit; offset += 65536) {
            const finish = Math.min(limit, offset + 65536);
            scratch.set(order.subarray(offset, finish), out);
            out += finish - offset;
            if (performance.now() >= deadline) await pause();
          }
        }
      }
      [order, scratch] = [scratch, order];
      if (performance.now() >= deadline) await pause();
    }
  }
  let keep;
  if (mode === "unique") {
    keep = new Uint8Array(count);
    let previous;
    for (const row of order) {
      let equal = previous === undefined ? 1 : lexical(previous, row);
      if (typeof equal?.then === "function") equal = await equal;
      if (equal !== 0) {
        keep[row] = 1;
        previous = row;
      }
      if (performance.now() >= deadline) await pause();
    }
  }
  let output = source.subtext(0, 0),
    parts = [],
    units = 0,
    emitted = 0;
  const flush = () => {
    if (units) output = output.replace(output.length, output.length, parts.join(""));
    parts = [];
    units = 0;
  };
  const append = (text) => {
    parts.push(text);
    units += text.length;
    if (units >= 65536) flush();
  };
  for (let index = 0; index < count; index++) {
    const row = keep ? index : order[index];
    if (keep && !keep[row]) continue;
    if (emitted++) append(ending);
    if (lengthOf(row) > CHUNK) {
      flush();
      output = output.replace(
        output.length,
        output.length,
        source.subtext(startOf(row), endOf(row)),
      );
    } else append(line(row));
    if ((index & 1023) === 0 && performance.now() >= deadline) await pause();
  }
  flush();
  check();
  return output;
}
module.exports = { transformLines };
