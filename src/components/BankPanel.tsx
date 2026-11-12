import { CATEGORIES } from "../bank/types";

type Props = {
  selected: string[];
  total: Record<string, number>;
  used: Record<string, number>;
  pickCount: number;
  maxCount: number;
  optionCount: number;
  message: string;
  onSelected: (next: string[]) => void;
  onPickCount: (value: number) => void;
  onOptionCount: (value: number) => void;
  onPick: () => void;
  onResetHistory: () => void;
};

export default function BankPanel(props: Props) {
  const totalSelected = props.selected.reduce((sum, id) => sum + (props.total[id] ?? 0), 0);
  const usedSelected = props.selected.reduce((sum, id) => sum + (props.used[id] ?? 0), 0);
  const allTotal = Object.values(props.total).reduce((sum, value) => sum + value, 0);

  function toggle(id: string) {
    props.onSelected(
      props.selected.includes(id) ? props.selected.filter((c) => c !== id) : [...props.selected, id],
    );
  }

  return (
    <div className="bank">
      <p className="hint">
        The question bank has {allTotal} questions (English and Arabic). Each time you press the button, random
        questions are picked that you have not used before. You can still edit them below.
      </p>

      <div className="cats">
        {CATEGORIES.map((cat) => (
          <label key={cat.id} className="check cat">
            <input type="checkbox" checked={props.selected.includes(cat.id)} onChange={() => toggle(cat.id)} />
            <span>
              {cat.en} · {cat.ar}
              <small>
                {" "}
                ({(props.total[cat.id] ?? 0) - (props.used[cat.id] ?? 0)} / {props.total[cat.id] ?? 0} unused)
              </small>
            </span>
          </label>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="ghost small" onClick={() => props.onSelected(CATEGORIES.map((c) => c.id))}>
          All topics
        </button>
        <button type="button" className="ghost small" onClick={() => props.onSelected([])}>
          None
        </button>
      </div>

      <div className="row">
        <div>
          <label htmlFor="pickcount">Questions in this video: {props.pickCount}</label>
          <input
            id="pickcount"
            type="range"
            min={1}
            max={props.maxCount}
            value={props.pickCount}
            onChange={(e) => props.onPickCount(Number(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="optcount">Options per question</label>
          <select id="optcount" value={props.optionCount} onChange={(e) => props.onOptionCount(Number(e.target.value))}>
            <option value={3}>3 options</option>
            <option value={4}>4 options</option>
          </select>
        </div>
      </div>

      <div className="actions">
        <button type="button" className="primary" disabled={props.selected.length === 0} onClick={props.onPick}>
          Pick random questions
        </button>
        <button type="button" className="ghost" onClick={props.onResetHistory}>
          Forget what I used ({usedSelected} of {totalSelected} used in these topics)
        </button>
      </div>
      {props.message ? <p className="ok">{props.message}</p> : null}
    </div>
  );
}
