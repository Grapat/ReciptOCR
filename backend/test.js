const express = require('express');
const app = express();
app.get('*', (req, res) => res.send('Catch-all works!'));
app.listen(3000, () => console.log('Test server running'));