import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";

export interface TabItem<T extends string> { id: T; label: ReactNode }

interface Props<T extends string> {
  items: TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  idPrefix: string;
  label: string;
  className: string;
}

export default function AccessibleTabs<T extends string>({ items, selected, onSelect, idPrefix, label, className }: Props<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  useEffect(() => { refs.current.get(selected)?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [selected]);

  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onSelect(items[next].id);
    refs.current.get(items[next].id)?.focus();
  };

  return (
    <div className={className} role="tablist" aria-label={label}>
      {items.map((item, index) => <button
        key={item.id}
        ref={(element) => { if (element) refs.current.set(item.id, element); else refs.current.delete(item.id); }}
        id={`${idPrefix}-tab-${item.id}`}
        role="tab"
        aria-selected={selected === item.id}
        aria-controls={`${idPrefix}-panel-${item.id}`}
        tabIndex={selected === item.id ? 0 : -1}
        className={selected === item.id ? "active" : ""}
        onClick={() => onSelect(item.id)}
        onKeyDown={(event) => keyDown(event, index)}
      >{item.label}</button>)}
    </div>
  );
}
