export default [
    {
        files: ["src/**/*.js"],
        ignores: ["node_modules/**"],
        languageOptions: {
            ecmaVersion: 2022,
        },
        rules: {
            semi: "error",
            "prefer-const": "error",
            indent: ["error", 4],
        },
    },
]
