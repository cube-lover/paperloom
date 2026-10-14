import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('native_worker',ROOT/'tools/native-background.py')
N=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(N)
try:
    import pymupdf as F
except ImportError:
    F=None


@unittest.skipUnless(F,'PyMuPDF optional; run with configured native worker Python')
class NativeWorkerTests(unittest.TestCase):
    def fixture(self,root,rotation=0,cropped=False):
        doc=F.open();p=doc.new_page(width=400,height=500)
        p.draw_rect(p.rect,fill=(.92,.92,.92),color=None)
        p.draw_line((20,105),(380,105),color=(.5,.5,.5),dashes='[3 3]')
        p.draw_polyline([(20,180),(160,100),(380,150)],color=(.1,.4,.9))
        p.insert_text((70,110),'Fine-tuned SOTA',fontsize=12)
        p.insert_text((190,110),'89.0 175B',fontsize=12)
        p.insert_text((35,220),'Accuracy',fontsize=10,rotate=90)
        if cropped:p.set_cropbox(F.Rect(20,30,380,460))
        p.set_rotation(0);inv=~p.transformation_matrix
        labels=[]
        for i,t in enumerate(['Fine-tuned SOTA','Accuracy']):
            r=p.search_for(t)[0];q=[[r.x0,r.y0],[r.x1,r.y0],[r.x1,r.y1],[r.x0,r.y1]]
            labels.append({'id':'label'+str(i),'text':t,'sourceQuad':[list(F.Point(x)*inv) for x in q]})
        p.set_rotation(rotation);source=root/'source.pdf';doc.save(source);doc.close()
        req={'version':1,'sourceSHA256':N.sha(source.read_bytes()),'pageIndex':0,'labels':labels}
        return source,req

    def test_text_only_removal_preserves_paths_numbers_and_all_page_rotations(self):
        for rotation in [0,90,180,270]:
            for crop in [False,True]:
                with self.subTest(rotation=rotation,crop=crop),tempfile.TemporaryDirectory(dir=ROOT/'.local') as tmp:
                    root=pathlib.Path(tmp);source,req=self.fixture(root,rotation,crop)
                    before=source.read_bytes();report=N.generate(source,req,root/'artifact')
                    self.assertEqual(source.read_bytes(),before)
                    self.assertTrue(all(report['checks'].values()))
                    self.assertFalse(report['renderVerified'])
                    with F.open(root/'artifact/clean.pdf') as p:
                        self.assertIn('89.0 175B',p[0].get_text())
                        self.assertNotIn('Fine-tuned',p[0].get_text())
                        self.assertNotIn('Accuracy',p[0].get_text())
                        self.assertEqual(p[0].rotation,rotation)

    def test_wrong_source_and_overwide_frame_fail_without_clean_artifact(self):
        for kind in ['hash','text','frame','duplicate']:
            with self.subTest(kind=kind),tempfile.TemporaryDirectory(dir=ROOT/'.local') as tmp:
                root=pathlib.Path(tmp);source,req=self.fixture(root)
                if kind=='hash':req['sourceSHA256']='0'*64
                if kind=='text':req['labels'][0]['text']='Wrong Label'
                if kind=='frame':req['labels'][0]['sourceQuad']=[[20,420],[350,420],[350,370],[20,370]]
                if kind=='duplicate':req['labels'].append({**req['labels'][0],'id':'other'})
                with self.assertRaises(ValueError):N.generate(source,req,root/'artifact')
                self.assertFalse((root/'artifact/clean.pdf').exists())

    def test_existing_output_never_overwritten(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'.local') as tmp:
            root=pathlib.Path(tmp);source,req=self.fixture(root)
            with self.assertRaisesRegex(ValueError,'output_must_be_new'):N.generate(source,req,root)
            self.assertTrue(source.exists())

    def test_real_page19_is_not_a_special_case(self):
        src=ROOT.parent/'paperloom-review/fit-study/gpt3-public.pdf'
        if not src.exists():self.skipTest('Public regression PDF optional')
        with tempfile.TemporaryDirectory(dir=ROOT/'.local') as tmp,F.open(src) as doc:
            p=doc[18];inv=~p.transformation_matrix
            labels=[]
            for i,r in enumerate(p.search_for('Fine-tuned SOTA')):
                labels.append({'id':'row'+str(i),'text':'Fine-tuned SOTA','sourceQuad':[list(pt*inv) for pt in [r.tl,r.tr,r.br,r.bl]]})
            req={'version':1,'sourceSHA256':N.sha(src.read_bytes()),'pageIndex':18,'labels':labels}
            report=N.generate(src,req,pathlib.Path(tmp)/'artifact')
            self.assertEqual(len(report['labels']),2)
            self.assertTrue(all(report['checks'].values()))


class ContractTests(unittest.TestCase):
    def test_reject_nonfinite_and_bad_polygon(self):
        r={'version':1,'sourceSHA256':'a'*64,'pageIndex':0,'labels':[{'id':'a','text':'x','sourceQuad':[[0,0],[2,0],[2,2],[0,2]]}]}
        N.validate(r)
        for q in [[[0,0],[2,2],[2,0],[0,2]],[[0,0],[float('nan'),0],[2,2],[0,2]]]:
            r['labels'][0]['sourceQuad']=q
            with self.assertRaises(ValueError):N.validate(r)

if __name__=='__main__':unittest.main()
