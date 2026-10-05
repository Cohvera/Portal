import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
import qbox_sync as q

def fixture():
    now=datetime.now(timezone.utc)
    data=dict(schema_version=2,source_kind='central_datahub',source_system='PLENION',live=True,snapshot_id='test',batch_id='batch',source_observed_at=(now-timedelta(minutes=1)).isoformat(),valid_until=(now+timedelta(hours=1)).isoformat(),projects=[dict(number='123',customer='Customer',description='Project',planned='',status_label='07 - In Uitvoering',evidence='central_datahub',active=True,is_current=True,closed=False)])
    status=dict(state='SUCCESS',source_kind='central_datahub',batch_id='batch',hub_snapshot_id='test',heartbeat_at=now.isoformat(),source_observed_at=data['source_observed_at'])
    return data,status

class Tests(unittest.TestCase):
    def test_validation(self):
        data,status=fixture()
        self.assertEqual(len(q.validate(data,status)['projects']),1)
        for changes in [dict(live=False),dict(source_kind='user_screenshots'),dict(valid_until='2000-01-01T00:00:00Z'),dict(projects=data['projects']*2)]:
            with self.assertRaises(q.SyncError): q.validate(dict(data,**changes),status)
        with self.assertRaises(q.SyncError): q.validate(data,dict(status,batch_id='different'))
        with self.assertRaises(q.SyncError): q.validate(data,dict(status,heartbeat_at='2000-01-01T00:00:00Z'))
        with self.assertRaises(q.SyncError): q.https_url('http://example.com')
        self.assertIsNone(q.NoRedirect().redirect_request(None,None,302,'',{},'https://other.example'))

    def test_ack_retry_deduplication_and_no_secret_in_state(self):
        data,status=fixture()
        with tempfile.TemporaryDirectory() as directory:
            config=dict(source='https://source.lan',destination='https://portal.example',key='x'*43,ca=None,state=Path(directory)/'state.json')
            with patch.object(q,'read_json',side_effect=[data,status,dict(accepted=True,snapshotId='test',count=1)]) as call:
                self.assertEqual(q.sync_once(config),'accepted')
                self.assertEqual(call.call_count,3)
                self.assertNotIn(config['key'],config['state'].read_text())
            with patch.object(q,'read_json',side_effect=[data,status]) as call:
                self.assertEqual(q.sync_once(config),'unchanged')
                self.assertEqual(call.call_count,2)
            config['state'].unlink()
            with patch.object(q,'read_json',side_effect=[data,status,q.SyncError('HTTP 503')]):
                with self.assertRaises(q.SyncError): q.sync_once(config)
                self.assertFalse(config['state'].exists())
            with patch.object(q,'read_json',side_effect=[data,status,dict(accepted=True,snapshotId='test',count=1,duplicate=True)]):
                self.assertEqual(q.sync_once(config),'accepted')

    def test_dry_run_never_sends(self):
        data,status=fixture()
        with patch.object(q,'read_json',side_effect=[data,status]) as call:
            self.assertEqual(q.sync_once(dict(source='https://source.lan',ca=None),True),'validated')
            self.assertEqual(call.call_count,2)

if __name__=='__main__': unittest.main()
