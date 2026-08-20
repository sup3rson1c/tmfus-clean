/* End-to-end test of the application encryption chain.
 *
 *   offline tool     ->  RSA keypair
 *   application.php  ->  seals an envelope with the PUBLIC key
 *   admin.php setup  ->  wraps the PRIVATE key under the admin password
 *   admin.php login  ->  unwraps it when that password is typed
 *   admin.php viewer ->  decrypts the envelope
 *
 * The one step not reproduced here is the handoff itself: the login page
 * parks the unwrapped CryptoKey in IndexedDB and the inbox page picks it
 * up. Node has no IndexedDB. Everything either side of that is covered.
 *
 * The PHP side is reproduced with node:crypto using exactly the
 * primitives openssl uses for OPENSSL_PKCS1_OAEP_PADDING (OAEP/SHA-1)
 * and 'aes-256-gcm'. If this passes, a real application sealed by
 * application.php opens in admin.php.
 */
import { webcrypto, publicEncrypt, randomBytes, createCipheriv, constants } from 'node:crypto';

const subtle = webcrypto.subtle;
const b64 = (b) => Buffer.from(b).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

let failures = 0;
const check = (name, ok, extra) => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? ' — ' + extra : ''));
  if (!ok) failures++;
};

/* ---------- 1. the offline tool generates the pair ---------- */
const pair = await subtle.generateKey(
  { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-1' },
  true,
  ['encrypt', 'decrypt']
);
const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
const publicPem = '-----BEGIN PUBLIC KEY-----\n' +
  (b64(spki).match(/.{1,64}/g) || []).join('\n') + '\n-----END PUBLIC KEY-----\n';
check('keypair generated and exported', pkcs8.length > 0 && spki.length > 0);

/* ---------- 2. application.php seals an application ---------- */
function sealEnvelope(plaintext, publicKeyPem) {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', aesKey, iv);
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  const sealedKey = publicEncrypt(
    { key: publicKeyPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
    aesKey
  );
  return {
    v: 1,
    alg: 'RSA-OAEP-SHA1 + AES-256-GCM',
    created: new Date().toISOString(),
    key_id: 'testkey00000000',
    sealed_key: b64(sealedKey),
    iv: b64(iv),
    tag: b64(tag),
    data: b64(ct)
  };
}

const record = {
  reference: 'A1B2C3',
  received: new Date().toISOString(),
  application: {
    business_legal_name: 'Acme Trading LLC',
    owner_name: 'Jane Doe',
    owner_ssn: '123-45-6789',
    owner_dob: '04/12/1979',
    owner_signature: 'data:image/png;base64,iVBORw0KGgo='
  },
  audit: { ip: '203.0.113.9', consent_text_id: 'tmf-auth-2026-08b' }
};
const envelope = sealEnvelope(JSON.stringify(record), publicPem);
check('envelope sealed by the PHP-equivalent path', !!envelope.sealed_key);
check('envelope carries a key_id', !!envelope.key_id);

/* ---------- 3. the admin.php vault wraps the private key ---------- */
const PBKDF2_ITER = 310000;
// Whatever is in admin_password in api/config.php. Any string works here;
// what is being tested is the wrapping, not the password.
const PASS = 'correct horse battery staple';

async function deriveWrapKey(passphrase, salt) {
  const base = await subtle.importKey('raw', new TextEncoder().encode(passphrase),
                                      { name: 'PBKDF2' }, false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const salt = webcrypto.getRandomValues(new Uint8Array(16));
const wIv = webcrypto.getRandomValues(new Uint8Array(12));
const wrapped = await deriveWrapKey(PASS, salt)
  .then((wk) => subtle.encrypt({ name: 'AES-GCM', iv: wIv }, wk, pkcs8));
const vault = { v: 2, iter: PBKDF2_ITER, salt: b64(salt), iv: b64(wIv), data: b64(wrapped) };
check('private key wrapped under the admin password', vault.data.length > 100);
check('wrapped blob is not the key in the clear', vault.data !== b64(pkcs8));

/* ---------- 4. the wrong passphrase must not open it ---------- */
let wrongRejected = false;
try {
  const wk = await deriveWrapKey('the wrong password', unb64(vault.salt));
  await subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, wk, unb64(vault.data));
} catch (_) { wrongRejected = true; }
check('a wrong admin password unwraps nothing', wrongRejected);

/* ---------- 5. unlock, then open the application ---------- */
const wk = await deriveWrapKey(PASS, unb64(vault.salt));
const unwrappedPkcs8 = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, wk, unb64(vault.data));
const privKey = await subtle.importKey('pkcs8', unwrappedPkcs8,
                                       { name: 'RSA-OAEP', hash: 'SHA-1' }, false, ['decrypt']);
check('private key unwrapped and imported non-extractable', privKey.extractable === false);

const rawAes = await subtle.decrypt({ name: 'RSA-OAEP' }, privKey, unb64(envelope.sealed_key));
const aes = await subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, ['decrypt']);
const data = unb64(envelope.data), tag = unb64(envelope.tag);
const joined = new Uint8Array(data.length + tag.length);
joined.set(data, 0); joined.set(tag, data.length);
const plain = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(envelope.iv), tagLength: 128 }, aes, joined);
const opened = JSON.parse(new TextDecoder().decode(plain));

check('application decrypts', opened.reference === 'A1B2C3');
check('the SSN survives the round trip', opened.application.owner_ssn === '123-45-6789', opened.application.owner_ssn);
check('the date of birth survives', opened.application.owner_dob === '04/12/1979');
check('the signature survives', opened.application.owner_signature.startsWith('data:image/png'));

/* ---------- 6. a tampered envelope must fail, not decode garbage ---------- */
let tamperRejected = false;
try {
  const bad = unb64(envelope.data); bad[0] ^= 0xff;
  const j2 = new Uint8Array(bad.length + tag.length);
  j2.set(bad, 0); j2.set(tag, bad.length);
  await subtle.decrypt({ name: 'AES-GCM', iv: unb64(envelope.iv), tagLength: 128 }, aes, j2);
} catch (_) { tamperRejected = true; }
check('a tampered envelope is rejected by the GCM tag', tamperRejected);

console.log(failures === 0 ? '\nchain OK' : '\n' + failures + ' FAILED');
process.exit(failures === 0 ? 0 : 1);
