from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class UIContractTests(unittest.TestCase):
    def test_workbench_contains_the_priority_contract(self) -> None:
        html = (ROOT / "web" / "index.html").read_text()
        script = (ROOT / "web" / "app.js").read_text()
        for principle in ("customer", "leverage", "confidence", "learning", "cost"):
            self.assertIn(f'data-weight="{principle}"', html)
            self.assertIn(f'data-edit-principle="{principle}"', html)
            self.assertIn(f'data-rescore-principle="{principle}"', html)
        self.assertIn('min="0.1" max="99.6"', html)
        self.assertIn("Priority budget: 100 / 100 allocated", html)
        self.assertIn("const redistribute", script)
        self.assertIn('input.addEventListener("change"', script)
        self.assertIn("rankPrinciples", script)
        self.assertIn("priority_foregrounds.rescore_request/v1", script)
        self.assertIn('fetch("/api/rescore"', script)

    def test_model_reasons_are_rendered_as_text_not_markup(self) -> None:
        script = (ROOT / "web" / "app.js").read_text()
        self.assertIn("reason.textContent = item.scoreReasons[name]", script)
        self.assertNotIn("reason.innerHTML", script)
        self.assertIn("The evaluator returned an incomplete score set", script)
        self.assertIn("initiatives.some((item) => !byId.has(item.id))", script)

    def test_standalone_surface_has_no_riff_or_telephony_brand_assumptions(self) -> None:
        surface = "\n".join(
            path.read_text()
            for path in (ROOT / "web").iterdir()
            if path.is_file()
        ).lower()
        for forbidden in ("riff", "telnyx", "plumbing", "phone call", "m3", "m1"):
            self.assertNotIn(forbidden, surface)


if __name__ == "__main__":
    unittest.main()
