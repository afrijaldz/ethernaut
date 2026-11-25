const strings = import.meta.glob('../gamedata/*/strings.json', {
    eager: true,
    import: 'default',
});

export function loadTranslations(language) {
    return strings[`../gamedata/${language}/strings.json`] || strings['../gamedata/en/strings.json'];
}
