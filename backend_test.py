import server

app = server.app
with app.test_client() as client:
    resp = client.post('/api/chat', json={'history': [{'role': 'user', 'content': 'Hello'}]})
    print('STATUS', resp.status_code)
    print(resp.data.decode())
