const express = require('express')
const app = express()

app.set('view engine', 'ejs')
app.use(express.urlencoded({extended: false})) // permite acceder a los valores enviados por el usuario en un formulario a traves de req.body
app.use(express.static('public'))

// middleware
app.use(function(req, res, next) {
    res.locals.errors = []
    next()
})

app.get('/', (req, res) => {
    res.render('homepage')
})

app.get('/login', (req, res) => {
    res.render('login')
})

app.post('/register', (req, res) => {
    const errors = []

    // validar que los campos de registro sean de tipo string, en caso contrario vaciar los datos de registro del usuario
    if (typeof req.body.username !== 'string') req.body.username = ''
    if (typeof req.body.password !== 'string') req.body.password = ''

    req.body.username = req.body.username.trim()

    // validacion del nombre de usuario
    if (!req.body.username) errors.push('Username cannot be empty.')
    if (req.body.username && req.body.username.length < 3) errors.push('Username must be at least 3 characters long')
    if (req.body.username && req.body.username.length > 10) errors.push('Username must be at maximum of 10 characters')
    if (req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)) errors.push('Username must be contain letters and numbers')

    // validacion de la contraseña
    if (!req.body.password) errors.push('Password cannot be empty.')
    if (req.body.password && req.body.password.length < 8) errors.push('Password must be at least 8 characters long')
    if (req.body.password && req.body.password.length > 70) errors.push('Password must be at maximum of 70 characters')

    if (errors.length) return res.render('homepage', {errors})
})

app.listen(3000)
