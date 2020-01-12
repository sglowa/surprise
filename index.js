
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || "4000";

app.set('views', path.join(__dirname, "views"));
app.set('view engine', "pug");
app.use(express.static(path.join(__dirname, "public")));
app.use('/three', express.static(__dirname + '/node_modules/three/build/'));

/**
 * Render variables
 */

let renderVar = {}

 app.get('/', (req,res)=>{
 	res.render("index", renderVar);
 })

 app.listen(port, ()=>{
 	console.log(`Listening to requests on http://localhost:${port}`);
 })

