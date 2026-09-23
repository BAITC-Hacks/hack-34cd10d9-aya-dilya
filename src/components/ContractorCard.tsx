import type { RecommendationCard } from "../shared/contracts";
export const money = (value: number) => new Intl.NumberFormat("ru-RU").format(value);

export function ContractorCard({ card, index }: { card: RecommendationCard; index: number }) {
  return <article className="contractor-card" data-card-id={card.id}>
    <div className="card-top"><span className="card-category">{card.category}</span><span className="card-number">0{index + 1}</span></div>
    <h3>{card.name}</h3>
    <p className="card-city">{card.city}</p>
    <div className="card-price">от {money(card.priceFromKzt)} <span>₸</span></div>
    <div className="availability"><span aria-hidden="true">●</span> По календарю не занят</div>
    <p className="calendar-note">На выбранную дату, по данным каталога. Доступность не подтверждена подрядчиком.</p>
    <div className="explanation"><h4>Почему подходит</h4><p>{card.explanation}</p></div>
    {(card.synthetic || card.cityImputed || card.priceImputed) && <ul className="badges" aria-label="Происхождение данных">
      {card.synthetic && <li>Синтетические данные · тестовый профиль</li>}
      {card.cityImputed && <li>Город предположен</li>}
      {card.priceImputed && <li>Цена оценочная</li>}
    </ul>}
  </article>;
}
