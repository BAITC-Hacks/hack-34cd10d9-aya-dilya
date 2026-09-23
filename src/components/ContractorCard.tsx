import type { RecommendationCard } from "../shared/contracts";
export const money = (value: number) => new Intl.NumberFormat("ru-RU").format(value);

export function ContractorCard({ card, index, ai = false }: { card: RecommendationCard; index: number; ai?: boolean }) {
  return <article className="contractor-card" data-card-id={card.id}>
    <div className="card-top"><span className="card-category">{card.category}</span><span className="card-number">0{index + 1}</span></div>
    <div className="card-identity"><div><h3>{card.name}</h3>
    <p className="card-city">{card.city}</p>
    </div><div className="card-price">от {money(card.priceFromKzt)} <span>₸</span><small>начальная цена за событие</small></div></div>
    <div className="availability"><span aria-hidden="true">●</span> По календарю не занят</div>
    <p className="calendar-note">На выбранную дату, по данным каталога. Доступность не подтверждена подрядчиком.</p>
    <div className="explanation"><h4><span aria-hidden="true">✦</span> Почему подходит</h4><p>{card.explanation}</p></div>
    {!!card.evidence?.length && <details className="evidence"><summary>Цитаты, подтверждающие пожелания</summary>{card.evidence.map(item => <figure key={item.id}><blockquote>{item.quote}</blockquote><figcaption>{item.label} · Цитата из описания профиля</figcaption></figure>)}</details>}
    {!!card.unmatchedPreferences?.length && <p className="unmatched">Нет подтверждения в описании: {card.unmatchedPreferences.join(", ")}. Это не означает, что у подрядчика нет такого опыта.</p>}
    {ai && <details className="ai-evidence"><summary>На какие факты опирается AI</summary>{card.aiEvidence?.length ? <ul>{card.aiEvidence.map((item, i) => <li key={i}><strong>{item.label}:</strong> {item.text}</li>)}</ul> : <p>Дополнительные факты не предоставлены.</p>}</details>}
    {(card.synthetic || card.cityImputed || card.priceImputed) && <ul className="badges" aria-label="Происхождение данных">
      {card.synthetic && <li>Синтетические данные · тестовый профиль</li>}
      {card.cityImputed && <li>Город предположен</li>}
      {card.priceImputed && <li>Цена оценочная</li>}
    </ul>}
  </article>;
}
