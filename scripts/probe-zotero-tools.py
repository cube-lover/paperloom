"""Read-only capability check for the installed Zotero toolchain. No library writes."""
import asyncio
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'validation' / 'zotero-toolchain'
OUT.mkdir(parents=True, exist_ok=True)
ENV = dict(os.environ, PYTHONUTF8='1', PYTHONIOENCODING='utf-8')
CLI = 'D:/Users/Administrator/Pi-Agent/home/bin/zotero-cli.exe'
MCP = 'D:/Users/Administrator/Pi-Agent/home/bin/zotero-mcp.exe'


def cli(name, *args):
    start = time.perf_counter()
    p = subprocess.run([CLI, '--json', *args], env=ENV, capture_output=True,
                       text=True, encoding='utf-8', timeout=120)
    data = json.loads(p.stdout)
    report = {'seconds': round(time.perf_counter() - start, 3), 'exitCode': p.returncode,
              'response': data}
    (OUT / (name + '.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'check': name, 'seconds': report['seconds'], 'ok': data.get('ok')}, ensure_ascii=False), flush=True)
    return report


async def mcp_inventory():
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    start = time.perf_counter()
    # Reuse standalone local-read configuration, never dump config or environments.
    with (OUT / 'mcp-startup.log').open('w', encoding='utf-8') as log:
        async with stdio_client(StdioServerParameters(command=MCP, args=['serve', '--transport', 'stdio'], env=ENV), errlog=log) as (read, write):
            async with ClientSession(read, write) as session:
                init = await session.initialize()
                result = await session.list_tools()
                inventory = {'seconds': round(time.perf_counter() - start, 3),
                             'server': init.server_info.model_dump(),
                             'tools': [t.model_dump() for t in result.tools]}
                (OUT / 'mcp-tools.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding='utf-8')
                print(json.dumps({'check': 'mcp-stdio-initialize-and-list', 'seconds': inventory['seconds'],
                                  'toolCount': len(result.tools), 'tools': [t.name for t in result.tools]}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    cli('attachment-path', 'path', 'PEYPJQ62')
    cli('problem-page-layouts', 'layout', 'PEYPJQ62', '--pages', '18-20,38,48-49')
    cli('problem-page-text', 'read', 'PEYPJQ62', '--start-page', '48', '--end-page', '49')
    asyncio.run(asyncio.wait_for(mcp_inventory(), timeout=90))
