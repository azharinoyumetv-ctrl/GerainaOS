"""Inventory local frontend API references against FastAPI route declarations.

This checks route/method existence, not runtime authorization, payload semantics,
third-party delivery, or dynamically constructed variables. It makes no requests.
"""
import argparse
import ast
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=root / 'android-app/app/build/reports/navigation-audit/api-inventory.json')
args = parser.parse_args()
routes = []
for file in sorted((root / 'backend').glob('*.py')):
    tree = ast.parse(file.read_text(encoding='utf-8-sig'))
    prefixes = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call) and getattr(node.value.func, 'id', None) == 'APIRouter':
            for target in node.targets:
                prefixes[getattr(target, 'id', '')] = next((kw.value.value for kw in node.value.keywords if kw.arg == 'prefix'), '')
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr in ['get', 'post', 'put', 'delete', 'patch'] and dec.args and isinstance(dec.args[0], ast.Constant):
                routes.append({'method': dec.func.attr.upper(), 'path': prefixes.get(getattr(dec.func.value, 'id', ''), '') + dec.args[0].value, 'file': file.relative_to(root).as_posix(), 'line': node.lineno})


def compatible(frontend, backend):
    left, right = frontend.strip('/').split('/'), backend.strip('/').split('/')
    return len(left) == len(right) and all(a == b or a == '{dynamic}' or b.startswith('{') for a, b in zip(left, right))


calls, unresolved = [], []
for file in sorted((root / 'frontend/src').rglob('*')):
    if file.suffix not in ['.js', '.jsx'] or '.test.' in file.name:
        continue
    source = file.read_text(encoding='utf-8')
    for match in re.finditer(r'api\.(get|post|put|delete|patch)\(\s*([^\n]+)', source):
        method, expression = match[1].upper(), match[2]
        row = {'method': method, 'file': file.relative_to(root).as_posix(), 'line': source[:match.start()].count('\n') + 1}
        literal = re.match(r'["\'`]([^"\'`]+)["\'`]', expression)
        if not literal or expression[literal.end():].lstrip().startswith('+'):
            unresolved.append({**row, 'expression': expression})
            continue
        path = '/api' + re.sub(r'\$\{[^}]+\}', '{dynamic}', literal[1].split('?')[0])
        candidates = [route for route in routes if route['method'] == method and compatible(path, route['path'])]
        calls.append({**row, 'path': path, 'matched': bool(candidates), 'candidates': [route['path'] for route in candidates]})
report = {'scope': __doc__.strip(), 'backendRouteCount': len(routes), 'frontendCallCount': len(calls), 'unresolvedVariableCalls': unresolved, 'unmatchedCalls': [call for call in calls if not call['matched']], 'routes': routes, 'calls': calls}
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: report[key] for key in ['backendRouteCount', 'frontendCallCount', 'unmatchedCalls', 'unresolvedVariableCalls']}, indent=2))
