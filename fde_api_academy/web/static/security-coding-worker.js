import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs";

const runtime = loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/" });

self.onmessage = async (event) => {
  const { requestId, code, entryFunction, tests } = event.data;
  try {
    const pyodide = await runtime;
    pyodide.globals.set("__academy_code", code);
    pyodide.globals.set("__academy_entry", entryFunction);
    pyodide.globals.set("__academy_tests", JSON.stringify(tests));
    const result = await pyodide.runPythonAsync(`
import contextlib
import io
import json
import traceback

namespace = {}
stdout = io.StringIO()
details = []
fatal = None

try:
    with contextlib.redirect_stdout(stdout):
        exec(__academy_code, namespace)
    candidate = namespace.get(__academy_entry)
    if not callable(candidate):
        raise NameError(f"Define a callable named {__academy_entry}.")

    for index, test in enumerate(json.loads(__academy_tests)):
        case_stdout = io.StringIO()
        try:
            with contextlib.redirect_stdout(case_stdout):
                actual = candidate(*test["args"])
            json.dumps(actual)
            passed = actual == test["expected"]
            details.append({
                "name": test["name"],
                "passed": passed,
                "expected": test["expected"],
                "actual": actual,
                "stdout": case_stdout.getvalue(),
            })
        except Exception:
            details.append({
                "name": test["name"],
                "passed": False,
                "expected": test["expected"],
                "actual": None,
                "stdout": case_stdout.getvalue(),
                "error": traceback.format_exc(limit=4),
            })
except Exception:
    fatal = traceback.format_exc(limit=6)

json.dumps({"details": details, "fatal": fatal, "stdout": stdout.getvalue()})
    `);
    self.postMessage({ requestId, ok: true, result: JSON.parse(result) });
  } catch (error) {
    self.postMessage({ requestId, ok: false, error: String(error?.message || error) });
  }
};
