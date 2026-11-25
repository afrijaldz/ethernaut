import React from 'react'
import { loadTranslations } from '../../utils/translations'
import { authors } from '../../gamedata/authors.json'

class Author extends React.Component {

  render() {
    let language = localStorage.getItem('lang')
    let strings = loadTranslations(language)

    const author = authors[this.props.author]
    if(!author) return null

    return (
      <section className="ui-card level-author">
        <h2 className="level-author__title">{strings.levelAuthor}</h2>

        <ul className="level-author__list">
          {author.name.map((name, i) => (
            <li key={name} className="level-author__person">
              <strong>{name}</strong>
              {author.emails[i] && (
                <a
                  className="level-author__link"
                  href={`mailto:${author.emails[i]}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label={`${name}: ${author.emails[i]}`}
                >
                  <i className="fa fa-envelope" aria-hidden="true"></i>
                </a>
              )}
              {author.websites[i] && (
                <a
                  className="level-author__link"
                  href={author.websites[i]}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label={`${name}: ${author.websites[i]}`}
                >
                  <i className="fa fa-globe" aria-hidden="true"></i>
                </a>
              )}
            </li>
          ))}
        </ul>

        {author.donate && (
          <p className="level-author__donate">
            {strings.donate} <code>{author.donate}</code>
          </p>
        )}
      </section>
    )
  }
}

export default Author
