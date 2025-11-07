/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./editor.html",
        "./admin.html",
        "./prepare.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            typography: ({ theme }) => ({
                invert: {
                    css: {
                        '--tw-prose-body': theme('colors.gray[300]'),
                        '--tw-prose-headings': theme('colors.white'),
                        '--tw-prose-lead': theme('colors.gray[400]'),
                        '--tw-prose-links': theme('colors.indigo[400]'),
                        '--tw-prose-bold': theme('colors.white'),
                        '--tw-prose-counters': theme('colors.gray[400]'),
                        '--tw-prose-bullets': theme('colors.gray[600]'),
                        '--tw-prose-hr': theme('colors.gray[700]'),
                        '--tw-prose-quotes': theme('colors.gray[100]'),
                        '--tw-prose-quote-borders': theme('colors.gray[700]'),
                        '--tw-prose-captions': theme('colors.gray[400]'),
                        '--tw-prose-code': theme('colors.white'),
                        '--tw-prose-pre-code': theme('colors.gray[300]'),
                        '--tw-prose-pre-bg': theme('colors.gray[900]'),
                        '--tw-prose-th-borders': theme('colors.gray[600]'),
                        '--tw-prose-td-borders': theme('colors.gray[700]'),
                    },
                },
            }),
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
};