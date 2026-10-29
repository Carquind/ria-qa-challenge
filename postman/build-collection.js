// Generates postman/ria-api-tests.postman_collection.json (keeps the test scripts readable/diffable).
const fs = require('fs');
const path = require('path');

const ev = (lines) => [{ listen: 'test', script: { type: 'text/javascript', exec: lines } }];

const getTests = `
pm.test('Status is 200 OK', () => pm.response.to.have.status(200));

const posts = pm.response.json();

pm.test('Response is a non-empty array', () => {
  pm.expect(posts).to.be.an('array').that.is.not.empty;
});

pm.test('Every post has non-empty "title" and "body"', () => {
  const bad = posts.filter(p => !(typeof p.title === 'string' && p.title.trim() &&
                                  typeof p.body === 'string' && p.body.trim())).map(p => p.id);
  pm.expect(bad, 'post ids with empty title/body').to.be.empty;
});

pm.test('No field of any post contains the word "zombie"', () => {
  const offenders = [];
  posts.forEach(p => Object.entries(p).forEach(([k, v]) => {
    if (String(v).toLowerCase().includes('zombie')) offenders.push('post ' + p.id + '.' + k);
  }));
  pm.expect(offenders, 'fields containing "zombie"').to.be.empty;
});
`.trim().split('\n');

const postTests = `
pm.test('Status is 200 or 201', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));

// httpbin echoes the parsed JSON body under "json"
const echoed = pm.response.json().json;

pm.test('Echoed request body matches what was sent', () => {
  pm.expect(echoed.student).to.eql('Tim Allen');
  pm.expect(echoed.email_address).to.eql('tim@homeimprovement.com');
});

pm.test('topping is exactly bacon, cheese and mushroom', () => {
  pm.expect(echoed.topping).to.be.an('array');
  pm.expect(echoed.topping).to.have.members(['bacon', 'cheese', 'mushroom']);
  pm.expect(echoed.topping).to.have.lengthOf(3);
});

pm.test('topping does not contain chicken', () => {
  pm.expect(echoed.topping.map(t => String(t).toLowerCase())).to.not.include('chicken');
});
`.trim().split('\n');

const body = {
  student: 'Tim Allen',
  email_address: 'tim@homeimprovement.com',
  phone: '(408) 8674530',
  current_grade: 'B+',
  topping: ['bacon', 'cheese', 'mushroom'],
};

const collection = {
  info: {
    name: 'RIA QA Challenge - API tests',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'postsBaseUrl', value: 'https://jsonplaceholder.typicode.com' },
    { key: 'httpbinBaseUrl', value: 'https://httpbin.org' },
  ],
  item: [
    {
      name: 'GET /posts',
      event: ev(getTests),
      request: { method: 'GET', header: [], url: { raw: '{{postsBaseUrl}}/posts/', host: ['{{postsBaseUrl}}'], path: ['posts', ''] } },
    },
    {
      name: 'POST /post',
      event: ev(postTests),
      request: {
        method: 'POST',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } },
        url: { raw: '{{httpbinBaseUrl}}/post', host: ['{{httpbinBaseUrl}}'], path: ['post'] },
      },
    },
  ],
};

fs.writeFileSync(path.join(__dirname, 'ria-api-tests.postman_collection.json'), JSON.stringify(collection, null, 2));
console.log('collection written');
