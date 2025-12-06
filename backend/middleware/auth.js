const { expressjwt: jwt } = require('express-jwt');

// Middleware to protect routes – expects Authorization: Bearer <token>
module.exports = jwt({
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256']
});
