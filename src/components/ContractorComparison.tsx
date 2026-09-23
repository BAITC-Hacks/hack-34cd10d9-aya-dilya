import type { RecommendationCard } from "../shared/contracts";
import { money } from "./ContractorCard";

/** Compare only the cards already selected by the service, in their original order. */
export function ContractorComparison({ cards, ai = false }: { cards: RecommendationCard[]; ai?: boolean }) {
  if (cards.length < 2) return null;
  return <details className="comparison">
    <summary><span>Сравнить варианты <small>{cards.length} подрядчика рядом</small></span><span className="comparison-toggle" aria-hidden="true">+</span></summary>
    <p className="comparison-hint">Сравните цену и причины выбора. На узком экране таблицу можно прокрутить вправо.</p>
    <div className="comparison-scroll" role="region" aria-label="Таблица сравнения подрядчиков" tabIndex={0}>
      <table>
        <caption>Сравнение текущих результатов{ai ? " · объяснения с помощью AI" : " · по данным каталога"}</caption>
        <thead><tr><th scope="col">Что сравниваем</th>{cards.map(card => <th scope="col" key={card.id}>{card.name}<small>{card.category} · {card.city}</small></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Цена за событие</th>{cards.map(card => <td key={card.id}><strong className="comparison-price">от {money(card.priceFromKzt)} ₸</strong><small>Итоговую стоимость нужно уточнить</small></td>)}</tr>
          <tr><th scope="row">Почему подходит</th>{cards.map(card => <td key={card.id}>{card.explanation}</td>)}</tr>
          <tr><th scope="row">Пожелания и источники</th>{cards.map(card => <td key={card.id}>
            {card.evidence?.length ? card.evidence.map(item => <div className="comparison-evidence" key={item.id}><strong>{item.label}</strong><blockquote>{item.quote}</blockquote><small>Из описания профиля</small></div>) : <span>{card.evidence ? "Подтверждающих цитат для пожеланий нет." : "Пожелания не указаны."}</span>}
            {!!card.unmatchedPreferences?.length && <p className="unmatched">Нет подтверждения: {card.unmatchedPreferences.join(", ")}. Это не означает отсутствие опыта.</p>}
            {ai && !!card.aiEvidence?.length && <details className="ai-evidence"><summary>Факты для AI-объяснения</summary><ul>{card.aiEvidence.map((fact, index) => <li key={index}>{fact.label}: {fact.text}</li>)}</ul></details>}
          </td>)}</tr>
          <tr><th scope="row">На выбранную дату</th>{cards.map(card => <td key={card.id}>По календарю не занят<small>Подрядчик ещё не подтвердил доступность</small></td>)}</tr>
          <tr><th scope="row">Происхождение данных</th>{cards.map(card => <td key={card.id}>
            {card.synthetic && <p>Синтетические данные · тестовый профиль</p>}
            {card.cityImputed && <p>Город предположен</p>}
            {card.priceImputed && <p>Цена оценочная</p>}
            {!card.synthetic && !card.cityImputed && !card.priceImputed && <span>Без отметок синтетических или оценочных данных</span>}
            <small>Это не проверка подрядчика сервисом</small>
          </td>)}</tr>
        </tbody>
      </table>
    </div>
  </details>;
}
