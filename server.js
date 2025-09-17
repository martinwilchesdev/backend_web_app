require('dotenv').config()

// servidor de express
const express = require('express')

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')

// base de datos
const db = require('better-sqlite3')('app.db') // abrir o crear (si no existe) el archivo de base de datos app.db
db.pragma('journal_mode = WAL') // activar el modo de journaling de SQLite a WAL (en vez de bloquear todo el archivo de la BD, escribe un archivo de log y luego aplica los cambios)

// creacion de la tabla users
const createTables = db.transaction(() => {
    db.prepare(`
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username STRING NOT NULL UNIQUE,
        password STRING NOT NULL
    )`).run()
})
createTables() // invocar la funcion encargada de crear la tabla de usuarios

const app = express() // aplicacion de express

app.set('view engine', 'ejs')
app.use(express.urlencoded({extended: false})) // permite acceder a los valores enviados por el usuario en un formulario a traves de req.body
app.use(express.static('public')) // acceder a archivos estaticos desde los templates de ejs
app.use(cookieParser())

// middleware para configurar el valor por defecto del array errors utilizado en el template homepage
app.use(function(req, res, next) {
    res.locals.errors = []

    try {
        // decodificar el valor de la cookie de autenticacion del usuario
        const decoded = jwt.verify(req.cookies.galleta, process.env.JWT_SECRET)
        req.user = decoded
    } catch(e) {
        req.user = false
    }

    res.locals.user = req.user

    next()
})

app.get('/', (req, res) => {
    if (req.user) {
        return res.render('dashboard')
    }

    res.render('homepage')
})

app.get('/login', (req, res) => {
    res.render('login') // formulario de login
})

app.post('/login', async (req, res) => {
    let errors = []

    // validar que los campos de login sean de tipo string, en caso contrario vaciar los datos de registro del usuario
    if (typeof req.body.username !== 'string') req.body.username = ''
    if (typeof req.body.password !== 'string') req.body.password = ''

    if (req.body.username.trim() == '' || req.body.password.trim() == '') {
        errors = ['Invalid username or password']
    }

    if (errors.length) return res.render('login', { errors })

    // consultar el usuario en la base de datos
    const statement = db.prepare('SELECT * FROM users WHERE username = ?')
    const user = statement.get(req.body.username)

    if (!user) {
        errors = ['Invalid username or password']
        return res.render('login', { errors })
    }

    // validar credenciales de acceso
    const verifyPassword = await bcrypt.compare(req.body.password, user.password)

    if (!verifyPassword) {
        errors = ['Credentials are wrong']
        return res.render('login', { errors })
    }

    // crear token de autenticacion
    const token = jwt.sign({
        username: user.username,
        password: user.password
    }, process.env.JWT_SECRET)

    // agregar la cookie de autenticacion a la respuesta
    res.cookie('galleta', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 // expira en una hora (milisegundos)
    })

    res.redirect('/')
})

app.post('/register', async (req, res) => {
    const errors = []

    // validar que los campos de registro sean de tipo string, en caso contrario vaciar los datos de registro del usuario
    if (typeof req.body.username !== 'string') req.body.username = ''
    if (typeof req.body.password !== 'string') req.body.password = ''

    req.body.username = req.body.username.trim()

    // validacion del nombre de usuario
    if (!req.body.username) errors.push('Username cannot be empty.')
    if (req.body.username && req.body.username.length < 3) errors.push('Username must be at least 3 characters long')
    if (req.body.username && req.body.username.length > 10) errors.push('Username must be at maximum of 10 characters')
    if (req.body.username && !req.body.username.match(/^[a-zA-Z0-9]+$/)) errors.push('Username must be contain letters and numbers only')

    // validacion de la contraseña
    if (!req.body.password) errors.push('Password cannot be empty.')
    if (req.body.password && req.body.password.length < 8) errors.push('Password must be at least 8 characters long')
    if (req.body.password && req.body.password.length > 70) errors.push('Password must be at maximum of 70 characters')

    if (errors.length) return res.render('homepage', { errors })

    // guardar el usuario en base de datos
    const statement = db.prepare(`INSERT INTO users (username, password) VALUES (?, ?)`)

    const saltRounds = 10
    const hashPassword = await bcrypt.hash(req.body.password, saltRounds) // encriptar contraseña antes de guardarla en base datos

    // insertar el usuario en base de datos
    const result = statement.run(req.body.username, hashPassword)

    const resultStatement = db.prepare('SELECT * FROM users WHERE id = ?') // consulta para obtener la informacion del usuario previamente registrado
    const user = resultStatement.get(result.lastInsertRowid) // ejecutar la consulta pasando como parametro el id del usuario registrado

    // generar una al registrar un nuevo usuario
    const token = jwt.sign({
        username: user.username,
        userid: user.id},
    process.env.JWT_SECRET)

    res.cookie('galleta', token, { // (a, b) // a -> propiedad // b -> valor
        httpOnly: true, // la cookie es accesible unicamente por el servidor web
        secure: true, // marca la cookie para ser usada unica mente con HTTPS
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 // una hora
    })

    res.redirect('/')
})

app.get('/logout', (req, res) => {
    res.clearCookie('galleta') // eliminar la cookie de autenticacion
    res.redirect('/') // rediriger al usuario la ruta raiz
})

app.listen(3000)
