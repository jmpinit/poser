const express = require('express');

const PORT = 8000;

const app = express();
app.use(express.static('build'));

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
