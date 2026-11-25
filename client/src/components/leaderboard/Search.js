const Search = (props) => { 
    const { keyword, onKeywordChange } = props;

    const handleChange = (e) => { 
        onKeywordChange(e.target.value)
    }

    return (
        <div>
            <div>
                <input
                    type="text"
                    className="ui-input"
                    aria-label="Search player address / alias"
                    placeholder="Search player address / alias"
                    value={keyword}
                    onChange={handleChange}
                />
            </div>
        </div>
    )
}

export default Search