const express = require('express')
const app = express()
//https://github.com/keystonejs/keystone-classic/issues/3994
const port = process.env.PORT || 5000;//Heroku set the port dynamically not fixed!!
const path = require('path');
const ble =  require('./public/js/ble-module');
const multer = require('multer');
const fs    = require('fs');
const util  = require('util');


//app.use(formData.parse());
//app.use(body.urlencoded({extended:true}));

app.use(express.static(path.join(__dirname, 'public')));

//Apply original file name
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

const upload = multer({ storage:storage})
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))

app.post('/upload', upload.single('file'), function (req, res) {
    console.log('Received a POST request')
    console.log(req.file)
})