"use server";

import { revalidatePath } from "next/cache";
import {
  PRODUCT_QUESTION_BURST_ERROR,
  PRODUCT_QUESTION_RULE,
} from "@/lib/public-limits";
import {
  answerProductQuestion,
  productQuestionNeedsHandoff,
} from "@/lib/product-answers";
import { evaluateAgentPolicy } from "@/server/agent-policy";
import { recordAgentRun } from "@/server/agent-runs";
import { getProductBySku, listPublicProducts } from "@/server/catalog-store";
import { createProductQuestion } from "@/server/product-questions";
import { clientAddress, takePublicAttempt } from "@/server/public-guard";

export type SendProductQuestionState = { error: string | null; message: string | null };

export async function sendProductQuestionAction(
  _state: SendProductQuestionState,
  formData: FormData,
): Promise<SendProductQuestionState> {
  const address = await clientAddress();
  if (!takePublicAttempt("product-question", address, PRODUCT_QUESTION_RULE)) {
    return { error: PRODUCT_QUESTION_BURST_ERROR, message: null };
  }

  const sku = String(formData.get("sku") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 40);
  const question = String(formData.get("question") ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 200);

  if (!sku) return { error: "Falta el producto.", message: null };
  if (question.length < 8) return { error: "Escribe una pregunta un poco más clara (mínimo 8 caracteres).", message: null };

  const policy = await evaluateAgentPolicy("AG-05");
  if (!policy.ok) {
    return { error: policy.reason, message: null };
  }

  const product = await getProductBySku(sku);
  if (!product || !product.published) {
    return { error: "Ese producto ya no está publicado.", message: null };
  }

  const publicOk = (await listPublicProducts()).some((item) => item.sku === sku);
  if (!publicOk) return { error: "Ese producto ya no está en la tienda.", message: null };

  const autoReply = answerProductQuestion(
    {
      description: product.description,
      highlights: product.highlights,
      answers: product.answers,
      price: product.price,
      available: product.available,
      variants: product.variants,
      sizeKind: product.sizeKind,
    },
    question,
  );

  if (!productQuestionNeedsHandoff(autoReply)) {
    return {
      error: "La ficha ya responde eso. No hace falta enviarla a la tienda.",
      message: null,
    };
  }

  // Público: solo bandeja. No llama OpenAI (evita abuso de coste desde la tienda).
  const created = await createProductQuestion({
    productSku: sku,
    question,
    autoReply,
  });
  if (created.error) return { error: created.error, message: null };

  if (!created.duplicate) {
    await recordAgentRun({
      agentId: "AG-05",
      status: "succeeded",
      summary: `Handoff humano · sin modelo público · ${sku} · ${question.slice(0, 100)}`,
      costEstimateCop: 0,
    });

    revalidatePath("/panel");
    revalidatePath("/panel/agentes");
    revalidatePath("/panel/catalogo");
    revalidatePath(`/panel/catalogo/${encodeURIComponent(sku)}`);
    revalidatePath(`/tienda/producto/${encodeURIComponent(sku)}`);
  }

  return {
    error: null,
    message: created.duplicate
      ? "Esa pregunta ya está en la bandeja de la tienda. La revisan cuando puedan. No crea pedido ni cobra."
      : "Quedó en la bandeja de la tienda. La revisan cuando puedan. No crea pedido ni cobra.",
  };
}
