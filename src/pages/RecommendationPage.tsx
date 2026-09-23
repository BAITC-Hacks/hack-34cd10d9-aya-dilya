import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { RequestValidationError, type CatalogOptions, type SmartRecommendationRequest, type RecommendationResponse, type RecommendationService, type PlanBOption, type ValidationIssue } from "../shared/contracts";
import { smartExamples } from "../data/smart-examples";
import examples from "../data/demo-queries.json";
import { ContractorCard, money } from "../components/ContractorCard";
import { createLatestRequestRunner, serviceAdapter } from "./recommendationServiceAdapter";

type FormValues = { [K in keyof Required<SmartRecommendationRequest>]: string };
const allExamples = [...examples.scenarios, ...smartExamples];
const quickExamples = [
  { key: "dense-autumn", title: "Корпоратив", detail: "Сравнить ведущих" },
  { key: "rare-category", title: "Свадьба", detail: "Найти флориста" },
  { key: "smart-it", title: "IT-корпоратив", detail: "Учесть пожелания" },
  { key: "smart-plan-b", title: "План Б", detail: "Найти альтернативу" },
];
const emptyForm: FormValues = { city: "", date: "", eventFormat: "", category: "", budgetKzt: "", language: "", durationHours: "", preferences: "" };
type Outcome = { request: SmartRecommendationRequest; response: RecommendationResponse; submitted: FormValues };
const dateLabel = (value: string) => value.split("-").reverse().join(".");
const sameForm = (a: FormValues, b: FormValues) => Object.keys(a).every(key => a[key as keyof FormValues] === b[key as keyof FormValues]);

export function RecommendationPage({ service = serviceAdapter }: { service?: RecommendationService }) {
  const [catalog, setCatalog] = useState<CatalogOptions>();
  const [catalogError, setCatalogError] = useState(false);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();
  const [exampleKey, setExampleKey] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const runner = useMemo(() => createLatestRequestRunner(service), [service]);
  function loadCatalog() {
    setCatalogError(false);
    try { setCatalog(service.getCatalogOptions()); } catch { setCatalogError(true); }
  }
  useEffect(() => { loadCatalog(); return () => runner.invalidate(); }, [runner]);
  useEffect(() => {
    if (issues.length) formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [issues]);

  function update(field: keyof FormValues, value: string) {
    setForm(current => ({ ...current, [field]: value }));
    setIssues(current => current.filter(issue => issue.field !== field));
    setExampleKey("");
  }
  function loadExample(key: string) {
    const example = allExamples.find(item => item.key === key);
    if (!example) return;
    const request: SmartRecommendationRequest = example.request;
    runner.invalidate(); setLoading(false); setError(false); setIssues([]);
    setForm({ city: request.city, date: request.date, category: request.category, eventFormat: request.eventFormat,
      budgetKzt: String(request.budgetKzt), language: request.language ?? "", durationHours: request.durationHours === undefined ? "" : String(request.durationHours), preferences: request.preferences ?? "" });
    setExampleKey(key);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await runForm(form);
  }
  async function runForm(form: FormValues) {
    runner.invalidate(); setLoading(false); setError(false); setOutcome(undefined);
    const submitted = { ...form };
    const request: SmartRecommendationRequest = { city: form.city, date: form.date, eventFormat: form.eventFormat,
      category: form.category, budgetKzt: form.budgetKzt.trim() === "" ? NaN : Number(form.budgetKzt),
      ...(form.preferences.trim() ? { preferences: form.preferences.trim() } : {}),
      ...(form.language ? { language: form.language } : {}),
      ...(form.durationHours.trim() ? { durationHours: Number(form.durationHours) } : {}) };
    const missing: ValidationIssue[] = [];
    for (const [field, label] of [["city", "город"], ["date", "дату"], ["eventFormat", "формат"], ["category", "категорию"], ["budgetKzt", "бюджет"]] as const) {
      if (!form[field].trim()) missing.push({ field, message: `Укажите ${label}.` });
    }
    setIssues(missing);
    if (missing.length) return;
    setLoading(true);
    await runner.run(request, response => {
      setOutcome({ request, response, submitted }); setLoading(false);
    }, failure => {
      setLoading(false);
      if (failure instanceof RequestValidationError) setIssues(failure.issues);
      else setError(true);
    });
  }
  function applyAlternative(option: PlanBOption) {
    const request = option.request;
    const values: FormValues = { city: request.city, date: request.date, category: request.category,
      eventFormat: request.eventFormat, budgetKzt: String(request.budgetKzt), language: request.language ?? "",
      durationHours: request.durationHours === undefined ? "" : String(request.durationHours), preferences: request.preferences ?? "" };
    setForm(values); setExampleKey("");
    void runForm(values);
  }
  function select(field: "city" | "category" | "eventFormat" | "language", label: string, options: string[], optional = false) {
    const issue = issues.find(item => item.field === field);
    return <div className="field"><label htmlFor={field}>{label}{optional && <span>необязательно</span>}</label>
      <select id={field} name={field} value={form[field]} onChange={e => update(field, e.target.value)} required={!optional}
        aria-invalid={!!issue} aria-describedby={issue ? `${field}-error` : undefined}>
        <option value="">{optional ? "Неважно" : "Выберите"}</option>{options.map(option => <option key={option}>{option}</option>)}
      </select>{issue && <p className="field-error" id={`${field}-error`}>{issue.message}</p>}</div>;
  }
  function input(field: "date" | "budgetKzt" | "durationHours", label: string, optional = false) {
    const issue = issues.find(item => item.field === field);
    return <div className="field"><label htmlFor={field}>{label}{optional && <span>необязательно</span>}</label>
      <input id={field} name={field} type={field === "date" ? "date" : "number"} value={form[field]}
        onChange={e => update(field, e.target.value)} onInput={e => update(field, e.currentTarget.value)} required={!optional}
        min={field === "date" ? catalog?.dateRange.min : 0} max={field === "date" ? catalog?.dateRange.max : undefined}
        step={field === "durationHours" ? "any" : 1} placeholder={field === "date" ? undefined : field === "budgetKzt" ? "Например, 350 000" : "Например, 4"}
        aria-invalid={!!issue} aria-describedby={[`${field}-hint`, issue ? `${field}-error` : ""].filter(Boolean).join(" ")} />
      <p className="field-hint" id={`${field}-hint`}>{field === "date" ? `Календарь: ${dateLabel(catalog?.dateRange.min ?? "")}–${dateLabel(catalog?.dateRange.max ?? "")}` : field === "budgetKzt" ? "За одного подрядчика на мероприятие" : "Можно указать дробное число часов"}</p>
      {issue && <p className="field-error" id={`${field}-error`}>{issue.message}</p>}</div>;
  }
  return <div className="app-shell">
    <header className="header"><a className="brand" href="./" aria-label="Firebird — главная"><span className="brand-mark" aria-hidden="true">✳</span> firebird<span className="brand-dot">.</span></a><span className="header-note">ВАШЕ СОБЫТИЕ. ВАШИ ЛЮДИ.</span><span className="edition">Подбор для вашего события</span></header>
    <main>
      <section className="hero"><div className="eyebrow"><span /> ОТ ИДЕИ К СОБЫТИЮ</div><h1>Хорошее событие<br />начинается с <em>людей.</em></h1><p>Расскажите о вашем мероприятии. Мы найдём до трёх<br className="desktop-break" /> подрядчиков и объясним, почему они подходят.</p><div className="hero-stamp" aria-hidden="true">✳</div></section>
      <section className="quick-start" aria-label="Быстрые примеры">
        <div className="quick-intro"><strong>Начните с примера</strong><span>Заполним форму — условия можно изменить</span></div>
        <div className="quick-options">{quickExamples.map(item => <button type="button" key={item.key} disabled={!catalog} aria-pressed={exampleKey === item.key} onClick={() => loadExample(item.key)}><span>{item.title}</span><small>{item.detail}</small><i aria-hidden="true">↗</i></button>)}</div>
      </section>
      <div className="workspace">
        <section className="form-panel" aria-labelledby="form-title"><div className="section-heading"><span className="step">01</span><h2 id="form-title">Ваше мероприятие</h2></div>
          {catalogError ? <div role="alert" className="error-box">Не удалось загрузить параметры подбора.<button onClick={loadCatalog}>Повторить загрузку</button></div> : !catalog ? <p role="status">Загружаем параметры…</p> : <>
            <form ref={formRef} onSubmit={submit} noValidate>
              <div className="form-grid">{select("city", "Город", catalog.cities)}{input("date", "Дата мероприятия")}{select("eventFormat", "Формат", catalog.eventFormats)}{select("category", "Категория", catalog.categories)}<div className="full-width">{input("budgetKzt", "Бюджет в тенге, ₸")}</div></div>
              <div className="optional-heading">Чуть больше деталей <span>по желанию</span></div><div className="form-grid">{select("language", "Язык", catalog.languages, true)}{input("durationHours", "Длительность, ч", true)}</div>
              <div className="field preferences-field"><label htmlFor="preferences">Пожелания <span>необязательно</span></label>
                <textarea id="preferences" name="preferences" maxLength={500} rows={3} value={form.preferences}
                  placeholder="Например: IT-корпоратив, тактичный ведущий"
                  onChange={e => update("preferences", e.target.value)}
                  aria-invalid={issues.some(issue => issue.field === "preferences")}
                  aria-describedby="preferences-hint preferences-error" />
                <p className="field-hint" id="preferences-hint">{form.preferences.length}/500 · Пожелания влияют на порядок, но не ослабляют условия.</p>
                <p id="preferences-error" className="field-error">{issues.find(issue => issue.field === "preferences")?.message}</p>
              </div>
              {issues.length > 0 && <p role="alert" className="validation-summary">Проверьте выделенные поля.{issues.filter(issue => issue.field === "request").map(issue => ` ${issue.message}`)}</p>}
              <button className="submit-button" type="submit">{loading ? "Подобрать по новым условиям" : "Подобрать подрядчиков"}<span aria-hidden="true">↗</span></button>
              <p className="form-footnote">До трёх вариантов с объяснением выбора</p>{outcome && !loading && <a className="results-shortcut" href="#results">Посмотреть результаты ↓</a>}
            </form>
            <div className="examples"><label htmlFor="example">Нужна отправная точка?</label><select id="example" value={exampleKey} onChange={e => loadExample(e.target.value)}><option value="">Заполнить пример запроса</option>{allExamples.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><p>Пример только заполняет форму. Кнопка подбора запускает настоящий сервис.</p></div>
          </>}
        </section>
        <section className="results-panel" id="results" aria-labelledby="results-title"><div className="section-heading"><span className="step">02</span><h2 id="results-title">Ваши варианты</h2><span className="result-count">{outcome && !loading && !error ? `${outcome.response.cards.length} / 3` : 'ДО 3 ВАРИАНТОВ'}</span></div>
          <div role="status" aria-live="polite" className="status-line">{loading ? "Подбираем подрядчиков…" : outcome ? outcome.response.summary : ""}</div>
          {loading ? <div className="empty-state" aria-busy="true"><span className="loading-symbol" aria-hidden="true">✳</span><h3>Ищем подходящих людей</h3><p>Сверяем условия с каталогом и календарём.</p></div> : error ? <div className="error-box" role="alert"><h3>Не удалось выполнить подбор</h3><p>Ваши условия сохранены. Попробуйте ещё раз.</p><button onClick={() => formRef.current?.requestSubmit()}>Повторить подбор</button></div> : outcome ? <>
            <div className="request-summary"><h3>Условия этого подбора</h3><ul><li>{outcome.request.city}</li><li>{dateLabel(outcome.request.date)}</li><li>{outcome.request.eventFormat}</li><li>{outcome.request.category}</li><li>до {money(outcome.request.budgetKzt)} ₸</li><li>Пожелания: {outcome.request.preferences ?? "не указаны"}</li><li>Язык: {outcome.request.language ?? "неважно"}</li><li>Длительность: {outcome.request.durationHours === undefined ? "неважно" : `${outcome.request.durationHours} ч`}</li></ul>{!sameForm(form, outcome.submitted) && <p className="changed-note">Условия изменены — повторите подбор.</p>}</div>
            <div className="explanation-mode"><strong>{outcome.response.ai?.mode === "openai" ? "AI · Объяснение подготовлено с помощью AI" : "Объяснение по данным каталога"}</strong>
              {outcome.response.ai?.reason === "unavailable" && <p>AI или сервер недоступен. Подбор выполнен по правилам каталога.</p>}
              {outcome.response.ai?.reason === "invalid_response" && <p>Ответ AI не прошёл проверку. Использовано объяснение по данным каталога.</p>}
              {outcome.response.preferenceSummary && <p>{outcome.response.preferenceSummary}</p>}
            </div>
            {outcome.response.status === "matched" ? <div className="cards">{outcome.response.cards.map((card, index) => <ContractorCard key={card.id} card={card} index={index} ai={outcome.response.ai?.mode === "openai"} />)}</div> : <div className="empty-state no-match"><span aria-hidden="true">↗</span><h3>{outcome.response.status === "category_absent" ? "В этом городе пока нет такой категории" : "По этим условиям никто не подходит"}</h3><p>{outcome.response.status === "category_absent" ? "Попробуйте выбрать другой город или категорию." : "Попробуйте другую дату, пересмотрите бюджет или необязательные условия: язык и длительность."}</p><p>Мы не меняли ваши параметры.</p><button className="text-button" onClick={() => document.getElementById(outcome.response.status === "category_absent" ? "category" : "budgetKzt")?.focus()}>Изменить условия <span aria-hidden="true">↗</span></button></div>}
            {outcome.response.status === "no_match" && !!outcome.response.alternatives?.length && <section className="plan-b" aria-label="План Б">
              <div className="plan-heading"><span aria-hidden="true">↗</span><div><h3>Есть другой вариант</h3><p>План Б · Меняем только одно условие, с вашего согласия.</p></div></div>
              {!sameForm(form, outcome.submitted) && <p>Эти предложения относятся к условиям предыдущего подбора. Применение заменит текущие поля условиями выбранного варианта.</p>}
              {outcome.response.alternatives.map(option => <article className="alternative" key={option.id}>
                <span className="alternative-label">{option.kind === "budget" ? "Немного больше бюджет" : "Ближайшая подходящая дата"}</span><h4>{option.title}</h4><p>{option.description}</p>
                <p className="alternative-change">{option.kind === "budget" ? `Бюджет: ${money(outcome.request.budgetKzt)} → ${money(option.request.budgetKzt)} ₸` : `Дата: ${dateLabel(outcome.request.date)} → ${dateLabel(option.request.date)}`}</p>
                <p>Подходящих кандидатов: {option.candidateCount}. {option.candidateNames.join(", ")}</p>
                <button type="button" onClick={() => applyAlternative(option)}>Применить: {option.title}</button>
              </article>)}
            </section>}
          </> : <div className="empty-state initial-state"><div className="empty-art" aria-hidden="true"><span>✳</span><i>01</i><i>02</i><i>03</i></div><h3>Здесь начнётся ваша команда</h3><p>Заполните условия мероприятия —<br />мы предложим подходящих подрядчиков.</p><div className="empty-caption">КОНКРЕТНЫЕ ПРИЧИНЫ. ПОНЯТНЫЙ ВЫБОР.</div></div>}
        </section>
      </div>
      <aside className="data-note"><span aria-hidden="true">ⓘ</span><p>Подбор работает по локальному каталогу. В нём есть синтетические профили и оценочные данные — мы помечаем их в карточках. Цена «от» и свободная дата в каталоге не гарантируют итоговую стоимость и реальную доступность.</p></aside>
    </main><footer><span>firebird.</span><span>Меньше поисков. Больше события.</span><span>AYA & DILYA / 2026</span></footer>
  </div>;
}
