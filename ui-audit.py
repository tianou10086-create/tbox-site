#!/usr/bin/env python3
"""Audit the styles that the browser actually loads; never substitute a token draft."""
import argparse,json,os,shutil,subprocess,sys,tempfile
from pathlib import Path

def main():
    p=argparse.ArgumentParser()
    p.add_argument('root',nargs='?',default=str(Path(__file__).parent))
    p.add_argument('--desktop-token',type=Path,help='Legacy option: desktop tokens are not evidence for website contrast')
    p.add_argument('--json',action='store_true')
    p.add_argument('--output-dir',type=Path)
    p.add_argument('--origin',help='Read deployed HTTPS source instead of local files')
    p.add_argument('--host',default='tboxapp.top')
    a=p.parse_args();node=shutil.which('node')
    if not node: p.error('Node is required for computed-style checks; static-token fallback is not allowed')
    out=a.output_dir or Path(tempfile.mkdtemp(prefix='tbox-ui-audit-'))
    out.mkdir(parents=True,exist_ok=True)
    script=Path(__file__).with_name('ui-audit-browser.cjs')
    cmd=[node,str(script),'--root',str(Path(a.root).resolve()),'--output',str(out.resolve()),'--host',a.host]
    if a.origin: cmd+=['--origin',a.origin]
    r=subprocess.run(cmd,capture_output=True,text=True,encoding='utf8',errors='replace')
    result_path=out/'ui-audit-results.json'
    if not result_path.exists():
        print('UI AUDIT FAILED: browser did not produce evidence\n'+r.stderr,file=sys.stderr);return 1
    result=json.loads(result_path.read_text(encoding='utf8'))
    if r.returncode:
        result['status']='FAIL'
        result['errors'].append({'check':'browser-process','message':r.stderr[-1000:] or 'nonzero browser exit'})
    if a.desktop_token:result['legacy_desktop_option']='Not evaluated: this is a website computed-style gate'
    if a.json: print(json.dumps(result,ensure_ascii=False,indent=2))
    else: print(f"UI AUDIT {result['status']} views={len(result['views'])} errors={len(result['errors'])} evidence={result_path}")
    return 0 if result['status']=='PASS' and r.returncode==0 else 1
if __name__=='__main__':raise SystemExit(main())
