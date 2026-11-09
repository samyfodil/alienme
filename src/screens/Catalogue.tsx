import { ALIENS, ALIEN_KEYS, READINGS, type Alien } from '../data/aliens'

function Pips({ n }: { n: number }) {
  return (
    <span className="pips" role="img" aria-label={`${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} className={i <= n ? 'on' : ''} />
      ))}
    </span>
  )
}

export function SpeciesCard({ kind, index }: { kind: Alien; index: number }) {
  const a = ALIENS[kind]
  return (
    <article className="species-card" style={{ '--alien': a.color, '--alien-accent': a.accent }}>
      <div className="species-stage">
        <img src={`${import.meta.env.BASE_URL}species/${kind}.webp`} alt="" width="720" height="480" loading="lazy" />
      </div>
      <div className="species-body">
        <div className="species-id">
          <div className="species-kicker">Specimen {String(index + 1).padStart(2, '0')}</div>
          <h3 className="species-name">{a.name}</h3>
          <div className="species-title">{a.title}</div>
          <p className="species-tagline">{a.tagline}</p>
          <ul className="species-traits">
            {a.traits.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="species-more">
          <dl className="species-readings">
            {READINGS.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  <Pips n={a.readings[key]} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="species-blurb">{a.blurb}</p>
        </div>
      </div>
    </article>
  )
}

export default function Catalogue() {
  return (
    <section className="species" id="species" aria-labelledby="species-heading">
      <div className="species-head">
        <div className="tag">Field guide</div>
        <h2 id="species-heading">Known species</h2>
        <p>
          Six entities are currently living among you in human disguise. You may be one of them.
        </p>
      </div>
      <div className="species-grid">
        {ALIEN_KEYS.map((k, i) => (
          <SpeciesCard key={k} kind={k} index={i} />
        ))}
      </div>
    </section>
  )
}
