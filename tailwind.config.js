module.exports = {
  theme: {
    extend: {
      backgroundImage: theme => ({
         'hero-pattern': "url('/public/visa.jpg')", // Define your custom background image with a unique identifier
      })
    }
  },
  presets: [require('@vercel/examples-ui/tailwind')],
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './node_modules/@vercel/examples-ui/**/*.js',
  ],
}
