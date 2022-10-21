function castArray(value) {
    if(!value)
        return [];
    return Array.isArray(value) ? value : [value];
}

module.exports = {
    castArray
};