import { CATEGORIES } from '../../../shared/agent'
import { Field, type StepProps } from './fields'

export function StepIdentity({ draft, update }: StepProps): React.JSX.Element {
  return (
    <>
      <Field label="Nom">
        <input
          className="input"
          maxLength={40}
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
        />
      </Field>
      <Field label="Spécialité" hint="En une ligne : elle s'affiche sur la carte.">
        <input
          className="input"
          maxLength={80}
          placeholder="ex. : coach d'écriture"
          value={draft.specialty}
          onChange={(event) => update({ specialty: event.target.value })}
        />
      </Field>
      <Field label="Catégorie">
        <select
          className="input"
          value={draft.category}
          onChange={(event) => update({ category: event.target.value })}
        >
          {/* Une catégorie importée reste sélectionnable. */}
          {[...new Set<string>([...CATEGORIES, draft.category])].map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </Field>
      <Field label="Description courte">
        <textarea
          className="input"
          rows={3}
          maxLength={300}
          value={draft.description}
          onChange={(event) => update({ description: event.target.value })}
        />
      </Field>
    </>
  )
}
