// Explicit development-only browser harness. Not imported by the production entry.
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { recommendationService } from "../../src/core/index";
import { RecommendationPage } from "../../src/pages/RecommendationPage";
import "../../src/styles/app.css";

function Harness() {
  const [mode, setMode] = useState("delay");
  const service = useMemo(() => {
    let count = 0;
    return {
      getCatalogOptions() {
        if (mode === "catalog-error") throw new Error("test catalog error");
        return recommendationService.getCatalogOptions();
      },
      async recommend(request: Parameters<typeof recommendationService.recommend>[0]) {
        const first = ++count === 1;
        await new Promise(resolve => setTimeout(resolve, first ? 3000 : 30));
        if (mode === "error" || (mode === "stale-error" && first)) throw new Error("test error");
        const result = await recommendationService.recommend(request);
        if (mode === "ai-label") return { ...result, ai: { mode: "openai" as const }, cards: result.cards.map(card => ({ ...card, aiEvidence: [{ label: "Тест отображения фактов", text: card.explanation }] })) };
        return result;
      },
    };
  }, [mode]);
  return <><div style={{ padding: 16, background: "#ffe4a0" }}><strong>Тестовый стенд UI: искусственные задержки и ошибки, не продуктовый режим.</strong><label htmlFor="test-mode"> Режим проверки </label><select id="test-mode" style={{ maxWidth: 300 }} value={mode} onChange={e => setMode(e.target.value)}><option value="delay">Задержка первого ответа</option><option value="error">Техническая ошибка</option><option value="stale-error">Устаревшая ошибка</option><option value="ai-label">Тест маркировки AI (без вызова модели)</option><option value="catalog-error">Ошибка справочников</option></select></div><RecommendationPage key={mode} service={service} /></>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
