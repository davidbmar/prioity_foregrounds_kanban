from __future__ import annotations

import http.client
from http.server import ThreadingHTTPServer
import json
import threading
import unittest
from unittest import mock

from priority_foregrounds import rescore, server
from tests.test_rescore import evaluation, request


class ServerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), server.PriorityHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def connection(self) -> http.client.HTTPConnection:
        return http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)

    def test_static_page_and_health_have_security_headers(self) -> None:
        connection = self.connection()
        connection.request("GET", "/")
        response = connection.getresponse()
        body = response.read().decode()
        self.assertEqual(response.status, 200)
        self.assertIn("Priority Foregrounds Kanban", body)
        self.assertIn("default-src 'self'", response.getheader("Content-Security-Policy"))
        self.assertEqual(response.getheader("X-Frame-Options"), "DENY")
        connection.close()

        health = self.connection()
        health.request("GET", "/healthz")
        response = health.getresponse()
        payload = json.loads(response.read())
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["service"], "priority-foregrounds-kanban")
        health.close()

    def test_rescore_endpoint_returns_complete_result(self) -> None:
        def injected(payload: dict) -> dict:
            return rescore.rescore_queue(payload, evaluator=evaluation)

        with mock.patch.object(server, "rescore_queue", side_effect=injected):
            connection = self.connection()
            body = json.dumps(request())
            connection.request(
                "POST",
                "/api/rescore",
                body=body,
                headers={"Content-Type": "application/json"},
            )
            response = connection.getresponse()
            payload = json.loads(response.read())
            connection.close()
        self.assertEqual(response.status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["schema"], rescore.RESULT_SCHEMA)
        self.assertEqual(len(payload["scores"]), 2)

    def test_endpoint_rejects_rebinding_origin_and_wrong_content_type(self) -> None:
        rebound = self.connection()
        rebound.request(
            "POST",
            "/api/rescore",
            body=json.dumps(request()),
            headers={
                "Content-Type": "application/json",
                "Host": "attacker.example",
                "Origin": "http://attacker.example",
            },
        )
        response = rebound.getresponse()
        response.read()
        self.assertEqual(response.status, 403)
        rebound.close()

        wrong_type = self.connection()
        wrong_type.request("POST", "/api/rescore", body="{}", headers={"Content-Type": "text/plain"})
        response = wrong_type.getresponse()
        response.read()
        self.assertEqual(response.status, 415)
        wrong_type.close()


if __name__ == "__main__":
    unittest.main()

