import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('graphic_ocr', ROOT / 'tools' / 'ocr-image.py')
OCR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OCR)


class GraphicOCRTest(unittest.TestCase):
    def test_packaged_worker_is_identical(self):
        self.assertEqual((ROOT / 'tools/ocr-image.py').read_bytes(), (ROOT / 'addon/content/ocr-image.py').read_bytes())

    def test_invalid_input_returns_structured_error_not_paths(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.local') as d:
            output = pathlib.Path(d) / 'output.json'
            result = subprocess.run([sys.executable, str(ROOT / 'tools/ocr-image.py'), '--input', str(pathlib.Path(d) / 'missing.png'), '--output', str(output), '--runtime', str(ROOT / '.local/ocr-runtime'), '--models', str(ROOT / '.local/ocr-models')], capture_output=True, timeout=20)
            self.assertEqual(result.returncode, 1)
            data = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(data['version'], 1)
            self.assertIn('error', data)
            self.assertNotIn(d, data['error'])
            self.assertFalse(output.with_suffix('.tmp').exists())

    def test_remote_input_is_not_downloaded(self):
        with self.assertRaises((ValueError, OSError)):
            OCR.recognize('https://example.invalid/never-download.png', ROOT / '.local/ocr-runtime', ROOT / '.local/ocr-models')

    def test_short_high_confidence_pass_does_not_replace_complete_text(self):
        old={'text':'Multiple hazards temporal','score':.96,'polygon':OCR.reading_quad([0,0,150,20])}
        short={'text':'al','score':.999,'polygon':OCR.reading_quad([0,0,150,20])}
        rows=OCR.merge_passes([old],[short])
        self.assertEqual(rows[0]['text'],old['text'])

    def test_flow_boxes_keep_separate_nodes_and_all_source_members(self):
        sys.path.insert(0,str(ROOT / '.local/ocr-runtime'))
        from PIL import Image,ImageDraw
        image=Image.new('RGB',(500,200),'white');draw=ImageDraw.Draw(image);rows=[]
        for x in [10,170,330]:
            draw.rectangle((x,20,x+140,140),outline='black',width=2)
            for j,text in enumerate(['Alpha','network']):
                y=50+j*30;draw.rectangle((x+20,y,x+65,y+8),fill='black')
                rows.append({'text':text,'score':.999,'directionVerified':True,'rotation':0,'polygon':OCR.reading_quad([x+18,y-2,x+68,y+11])})
        grouped=OCR.group_flow_boxes(image,rows)
        self.assertEqual(len(grouped),3)
        self.assertTrue(all(r.get('flowNode') and r['text']=='Alpha network' for r in grouped))
        self.assertEqual(sum(len(r['members']) for r in grouped),6)

    def test_flow_branch_orientation_uses_agreeing_text_and_neighbouring_nodes(self):
        from types import SimpleNamespace
        image=SimpleNamespace(width=1000,height=1000)
        nodes=[{'text':'Node','flowNode':True,'directionVerified':True,'polygon':OCR.reading_quad([100+i*100,100,190+i*100,150])} for i in range(3)]
        def branch(): return {'text':'No','score':.998,'textConfirmed':True,'orientationAgreement':1,'rotation':0,'directionVerified':False,'polygon':OCR.reading_quad([200,180,220,190])}
        row=branch();OCR.verify_flow_branches(image,[*nodes,row]);self.assertTrue(row['directionVerified']);self.assertEqual(row['text'],'No')
        self.assertEqual(row['directionEvidence'],'upright-flow-neighbours')
        for patch in [{'textConfirmed':False},{'score':.8},{'rotation':180},{'text':'ON'}]:
            row=branch();row.update(patch);OCR.verify_flow_branches(image,[*nodes,row]);self.assertFalse(row['directionVerified'])
        row=branch();OCR.verify_flow_branches(image,[row]);self.assertFalse(row['directionVerified'])

    def test_reading_quad_preserves_source_bounds_and_both_vertical_directions(self):
        rect = [10, 20, 30, 200]
        self.assertEqual(OCR.reading_quad(rect, 270), [[10, 200], [10, 20], [30, 20], [30, 200]])
        self.assertEqual(OCR.reading_quad(rect, 90), [[30, 20], [30, 200], [10, 200], [10, 20]])
        for angle in [0, 90, 180, 270]:
            self.assertEqual(OCR.box_bounds(OCR.reading_quad(rect, angle)), rect)

    def test_horizontal_high_confidence_and_equal_score_get_direction_evidence(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        class Crop:
            width, height, size = 100, 40, (100, 40)
            def resize(self, *args): return self
            def rotate(self, angle, **kwargs): return angle
        class Source:
            size = (400, 400)
            def crop(self, rect): return Crop()
        pil = SimpleNamespace(Image=SimpleNamespace(Resampling=SimpleNamespace(LANCZOS=1)))
        for score in [.98, .99]:
            row = {'text': 'Parameters', 'score': score, 'polygon': OCR.reading_quad([10, 10, 110, 50])}
            engine = lambda angle, **kw: SimpleNamespace(txts=['Parameters' if angle == 0 else 'noise'], scores=[score if angle == 0 else .5])
            with patch.dict(sys.modules, {'PIL': pil}): OCR.enhance_rows(engine, Source(), [row])
            self.assertTrue(row['directionVerified'])
            self.assertEqual(row['text'], 'Parameters')
        row = {'text': 'Parameters', 'score': .99, 'polygon': OCR.reading_quad([10, 10, 110, 50])}
        engine = lambda angle, **kw: SimpleNamespace(txts=['Parameters'], scores=[.99 if angle == 0 else .96])
        with patch.dict(sys.modules, {'PIL': pil}): OCR.enhance_rows(engine, Source(), [row])
        self.assertFalse(row['directionVerified'])

    @unittest.skipUnless((ROOT / '.local/ocr-models/det.onnx').exists(), 'Local models are optional')
    def test_local_real_ocr_preserves_label_geometry_and_numbers(self):
        source = ROOT / '.local/graphic-text-research/chart-labels.png'
        if not source.exists():
            self.skipTest('Generated fixture not available')
        result = OCR.recognize(source, ROOT / '.local/ocr-runtime', ROOT / '.local/ocr-models')
        texts = [row['text'] for row in result['lines']]
        self.assertIn('Energy consumption', texts)
        self.assertIn('95.5', texts)
        self.assertEqual(result['width'], 1000)
        for row in result['lines']:
            self.assertEqual(len(row['polygon']), 4)
            for x, y in row['polygon']:
                self.assertTrue(0 <= x <= result['width'])
                self.assertTrue(0 <= y <= result['height'])

    @unittest.skipUnless((ROOT / '.local/ocr-models/det.onnx').exists(), 'Local models are optional')
    def test_chart_small_horizontal_and_rotated_vertical_ocr(self):
        source = ROOT / 'validation/graphics-rotation-source.png'
        if not source.exists():
            self.skipTest('Chart fixture not available')
        result = OCR.recognize(source, ROOT / '.local/ocr-runtime', ROOT / '.local/ocr-models')
        rows = result['lines']
        control = next(r for r in rows if r['text'] == 'control (105 seconds)')
        self.assertGreaterEqual(control['score'], .94)
        vertical = next(r for r in rows if r['text'] == 'Duration (seconds)')
        self.assertEqual(vertical['rotation'], 270)
        self.assertTrue(vertical['directionVerified'])
        self.assertLess(vertical['polygon'][1][1], vertical['polygon'][0][1])
        self.assertGreaterEqual(result['localPasses'], 1)

    @unittest.skipUnless((ROOT / '.local/ocr-models/det.onnx').exists(), 'Local models are optional')
    def test_opposite_90_degree_reading_direction_is_not_mirrored(self):
        sys.path.insert(0, str(ROOT / '.local/ocr-runtime'))
        from PIL import Image, ImageDraw, ImageFont
        with tempfile.TemporaryDirectory(dir=ROOT / '.local') as d:
            label = Image.new('RGB', (450, 55), 'white')
            ImageDraw.Draw(label).text((6, 8), 'Duration (seconds)', fill='black', font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 30))
            upright = Image.new('RGB', (150, 530), 'white')
            upright.paste(label.rotate(270, expand=True), (40, 40))
            source = pathlib.Path(d) / 'clockwise.png'
            upright.save(source)
            result = OCR.recognize(source, ROOT / '.local/ocr-runtime', ROOT / '.local/ocr-models')
            row = next(r for r in result['lines'] if r['text'] == 'Duration (seconds)')
            self.assertEqual(row['rotation'], 90)
            self.assertTrue(row['directionVerified'])
            self.assertGreater(row['polygon'][1][1], row['polygon'][0][1])


if __name__ == '__main__':
    unittest.main()

class FlowRegressionTest(unittest.TestCase):
    def test_faint_borders_and_ocr_padding_recover_all_24_rectangular_nodes(self):
        sys.path.insert(0,str(ROOT / '.local/ocr-runtime'))
        from PIL import Image
        rows=json.loads((ROOT/'tests/fixtures/flow12/rows.json').read_text())
        with Image.open(ROOT/'tests/fixtures/flow12/source.png') as image:
            result=OCR.group_flow_boxes(image,rows)
        nodes=[r for r in result if r.get('flowNode')]
        self.assertEqual(len(nodes),24)
        self.assertEqual(sum(len(r['members']) for r in nodes)+len(result)-len(nodes),len(rows))
        self.assertTrue(all(r['flowEvidence']['version']==2 for r in nodes))
        # Each six multi-line dependency nodes is a complete sentence frame.
        dependencies=[r for r in nodes if 'consideringbuffers' in r['text'].replace(' ','')]
        self.assertEqual(len(dependencies),6)
        self.assertTrue(all(len(r['members'])==3 for r in dependencies))

    def test_coloured_crossing_invalidates_node_interior(self):
        sys.path.insert(0,str(ROOT / '.local/ocr-runtime'))
        from PIL import Image,ImageDraw
        rows=json.loads((ROOT/'tests/fixtures/flow12/rows.json').read_text())
        with Image.open(ROOT/'tests/fixtures/flow12/source.png') as source:
            image=source.convert('RGB')
        ImageDraw.Draw(image).line((905,195,1380,195), fill=(0,100,230),width=2)
        result=OCR.group_flow_boxes(image,rows)
        self.assertFalse(any(r.get('flowNode') and 165<r['polygon'][0][1]<180 for r in result))
