const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

const hashPassword = (password) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    return `${salt}:${hash}`;
};

// Create superuser with password: SuperAdmin@2024
const email = 'superadmin@sandlabx.local';
const password = 'SuperAdmin@2024';
const role = 'admin';
const id = uuidv4();
const passwordHash = hashPassword(password);

console.log(`INSERT INTO sandlabx_users (id, email, password_hash, role) VALUES ('${id}', '${email}', '${passwordHash}', '${role}');`);
console.log('');
console.log('Superuser Credentials:');
console.log('Email:', email);
console.log('Password:', password);
console.log('Role:', role);
