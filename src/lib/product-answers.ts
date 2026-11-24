import type { SizeKind } from "@/lib/catalog";
import { formatCop } from "@/lib/format";
import { normalizeProductQuestionKey } from "@/lib/product-question-key";

export type AnswerableProduct = {
  description: string;
  highlights: string;
  answers: string;
  price: number;
  available: boolean;
  variants: string[];
  sizeKind?: SizeKind | null;
};

const STOP = new Set([
  "para",
  "como",
  "esta",
  "este",
  "esto",
  "esos",
  "esas",
  "sobre",
  "tiene",
  "tienen",
  "puede",
  "pueden",
  "cual",
  "cuales",
  "donde",
  "cuando",
  "porque",
  "desde",
  "hasta",
  "entre",
  "tambien",
  "solo",
  "cada",
  "todo",
  "toda",
  "todos",
  "todas",
  "muy",
  "mas",
  "que",
  "con",
  "por",
  "del",
  "los",
  "las",
  "una",
  "unos",
  "unas",
  "sus",
]);

/** Respuesta cuando la ficha no alcanza; el comprador puede derivarla a un humano. */
export const PRODUCT_QUESTION_HANDOFF_REPLY =
  "Eso no está escrito en la ficha. Puedes enviarla a la tienda para que la revisen. No crea pedido ni cobra.";

export function productQuestionNeedsHandoff(reply: string) {
  return reply === PRODUCT_QUESTION_HANDOFF_REPLY;
}

export function answerProductQuestion(product: AnswerableProduct, raw: string) {
  const question = fold(raw).trim();
  if (!question) return "Escribe la pregunta.";
  if (/\b(costo|margen|comision|comisiones|ganancia|utilidad)\b/.test(question)) {
    return "Eso no está en la ficha pública.";
  }

  const stored = matchStoredQa(product.answers, raw);
  if (stored) return stored;

  const lines = factLines(product);
  const matched = matchLines(question, lines);
  if (matched.length > 0 && !isBarePrice(question)) return joinLines(matched);

  if (isPrice(question)) {
    return `El precio publicado es ${formatCop(product.price)}. Pagas al recibir. Nadie cobra aquí.`;
  }
  if (/\b(disponible|agotado|stock)\b/.test(question) || question.includes("se puede pedir")) {
    return product.available
      ? "Está disponible para pedirlo. El pedido queda pendiente de confirmación. Nadie cobra aquí."
      : "Está publicado, pero ahora no se puede pedir. El precio publicado no cambia. Nadie cobra aquí.";
  }
  if (/\b(envio|despacho|demora|llega|flete|domicilio)\b/.test(question)) {
    return "El envío no está incluido y se acuerda antes de despachar. No hay una fecha prometida. No se cobra aquí.";
  }
  if (/\b(pagar|pago|contraentrega)\b/.test(question) || question.includes("contra entrega")) {
    return "Pagas el precio publicado cuando los recibes. Nadie cobra aquí. El pedido queda pendiente de confirmación.";
  }
  if (/\b(variante|variantes|color|colores|talla|tallas|medida|medidas|tamano|tamanos|modelo)\b/.test(question)) {
    if (product.variants.length > 0) {
      const noun = product.sizeKind === "tamano" ? "Los tamaños son" : "Las tallas son";
      return `${noun} ${joinNames(product.variants)}. El precio publicado es el mismo para todas. Elegir una no cobra ni crea un pedido.`;
    }
    return "En la ficha no hay tallas ni tamaños.";
  }
  if (matched.length > 0) return joinLines(matched);
  return PRODUCT_QUESTION_HANDOFF_REPLY;
}

export type AnswersDisplay = {
  prose: string;
  pairs: Array<{ question: string; answer: string }>;
};

/** Separa texto libre y pares P:/R: para mostrar al comprador sin el markup interno. */
export function formatAnswersForDisplay(answers: string): AnswersDisplay {
  const lines = answers.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const pairs: AnswersDisplay["pairs"] = [];
  const consumed = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (consumed.has(index)) continue;
    const prompt = lines[index].match(/^P:\s*(.+)$/i);
    if (!prompt) continue;
    const next = lines[index + 1]?.match(/^R:\s*(.+)$/i);
    if (!next) continue;
    const question = prompt[1].trim();
    const answer = next[1].trim();
    if (!question || !answer) continue;
    pairs.push({ question, answer });
    consumed.add(index);
    consumed.add(index + 1);
  }

  const prose = lines
    .filter((_, index) => !consumed.has(index))
    .map((line) => {
      const asPrompt = line.match(/^P:\s*(.+)$/i);
      if (asPrompt) return asPrompt[1].trim();
      const asReply = line.match(/^R:\s*(.+)$/i);
      if (asReply) return asReply[1].trim();
      return line;
    })
    .filter(Boolean)
    .join("\n");

  return { prose, pairs };
}

function matchStoredQa(answers: string, raw: string) {
  const key = normalizeProductQuestionKey(raw);
  if (!key) return null;
  const pairs = formatAnswersForDisplay(answers).pairs;
  const hit = pairs.find((pair) => normalizeProductQuestionKey(pair.question) === key);
  return hit?.answer ?? null;
}

function factLines(product: AnswerableProduct) {
  return [product.description, product.highlights, product.answers]
    .flatMap((block) => block.split(/\n/))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const asReply = line.match(/^R:\s*(.+)$/i);
      if (asReply) return asReply[1].trim();
      return line;
    })
    .filter((line) => line.length > 0 && !/^P:\s*/i.test(line));
}

function matchLines(question: string, lines: string[]) {
  const tokens = words(question).filter((word) => word.length >= 4 && !STOP.has(word));
  if (tokens.length === 0) return [];
  return lines
    .map((line) => {
      const folded = fold(line);
      const score = tokens.filter((token) => folded.includes(token)).length;
      return { line, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.line);
}

function isPrice(question: string) {
  if (/\b(precio|cuesta|cuestan|vale|valen)\b/.test(question)) return true;
  return /\bcuanto\b/.test(question) && !/\b(mide|pesa|dura|tarda|incluye|trae|demora)\b/.test(question);
}

function isBarePrice(question: string) {
  return isPrice(question) && words(question).filter((word) => !STOP.has(word) && word.length >= 4 && !/^(precio|cuesta|cuestan|vale|valen|cuanto)$/.test(word)).length === 0;
}

function joinLines(lines: string[]) {
  if (lines.length === 1) return lines[0];
  return `Según la ficha:\n${lines.map((line) => `• ${line}`).join("\n")}`;
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function words(value: string) {
  return value.split(/[^a-z0-9]+/).filter(Boolean);
}

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
}
