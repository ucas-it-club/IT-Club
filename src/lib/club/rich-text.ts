const prefix = "::club-rich-text-v1::";

type RichNode = {
  tag: string;
  href?: string;
  children: Array<RichNode | string>;
};

const blockTags = new Set(["p", "h2", "h3", "ul", "ol", "li", "blockquote"]);
const allowedTags = new Set([...blockTags, "strong", "em", "a", "br"]);
const aliases: Record<string, string> = { b: "strong", i: "em", div: "p" };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, code: string) => {
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      const lower = code.toLowerCase();
      if (named[lower]) return named[lower];
      const numeric = lower.startsWith("#x")
        ? Number.parseInt(lower.slice(2), 16)
        : Number.parseInt(lower.slice(1), 10);
      return Number.isSafeInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff
        ? String.fromCodePoint(numeric)
        : entity;
    },
  );
}

function safeHref(attributes: string) {
  const match = attributes.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const value = match?.[1] || match?.[2] || match?.[3];
  if (!value) return undefined;
  try {
    const url = new URL(decodeEntities(value));
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parse(html: string) {
  const root: RichNode = { tag: "root", children: [] };
  const stack = [root];
  const tokens = html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+|</g) || [];

  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;
    if (!token.startsWith("<")) {
      stack.at(-1)!.children.push(decodeEntities(token));
      continue;
    }

    const closing = token.match(/^<\s*\/\s*([a-z0-9]+)[^>]*>/i);
    if (closing) {
      const tag = aliases[closing[1]!.toLowerCase()] || closing[1]!.toLowerCase();
      let index = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.tag === tag) {
          index = i;
          break;
        }
      }
      if (index > 0) stack.splice(index);
      continue;
    }

    const opening = token.match(/^<\s*([a-z0-9]+)\b([^>]*)>/i);
    if (!opening) {
      stack.at(-1)!.children.push(token);
      continue;
    }
    const tag = aliases[opening[1]!.toLowerCase()] || opening[1]!.toLowerCase();
    if (!allowedTags.has(tag)) continue;
    if (tag === "br") {
      stack.at(-1)!.children.push({ tag, children: [] });
      continue;
    }
    const node: RichNode = { tag, children: [] };
    const href = tag === "a" ? safeHref(opening[2] || "") : undefined;
    if (href) node.href = href;
    stack.at(-1)!.children.push(node);
    stack.push(node);
  }

  return root.children;
}

function serializeNode(node: RichNode | string): string {
  if (typeof node === "string") return escapeHtml(node);
  if (node.tag === "br") return "<br>";
  const children = node.children.map(serializeNode).join("");
  if (node.tag === "a" && !node.href) return children;
  const attributes =
    node.tag === "a"
      ? ` href="${escapeHtml(node.href!)}" target="_blank" rel="noopener noreferrer"`
      : "";
  return `<${node.tag}${attributes}>${children}</${node.tag}>`;
}

function serialize(nodes: Array<RichNode | string>) {
  return nodes.map(serializeNode).join("");
}

function textOf(node: RichNode | string): string {
  if (typeof node === "string") return node;
  if (node.tag === "br") return "\n";
  const text = node.children.map(textOf).join("");
  return blockTags.has(node.tag) ? `${text}\n` : text;
}

export function isRichText(value: string | undefined) {
  return Boolean(value?.startsWith(prefix));
}

export function richTextHtml(value: string) {
  if (!isRichText(value)) return escapeHtml(value).replaceAll("\n", "<br>");
  return serialize(parse(value.slice(prefix.length)));
}

export function encodeRichText(html: string) {
  return prefix + serialize(parse(html));
}

export function plainRichText(value: string | undefined) {
  if (!value) return "";
  if (!isRichText(value)) return value;
  return parse(value.slice(prefix.length))
    .map(textOf)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitRichText(value: string) {
  if (!isRichText(value)) return value.split("\n").filter((line) => line.trim());

  const groups: Array<Array<RichNode | string>> = [];
  let inline: Array<RichNode | string> = [];
  const flush = () => {
    if (inline.length) groups.push(inline);
    inline = [];
  };

  for (const node of parse(value.slice(prefix.length))) {
    if (typeof node !== "string" && node.tag === "br") {
      flush();
    } else if (typeof node !== "string" && blockTags.has(node.tag)) {
      flush();
      groups.push([node]);
    } else {
      inline.push(node);
    }
  }
  flush();

  return groups
    .map((nodes) => prefix + serialize(nodes))
    .filter((entry) => plainRichText(entry).trim());
}
