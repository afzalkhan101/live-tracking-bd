
import base64
import json
from odoo import http
from odoo.http import request
class SalespersonTrackingPhoto(http.Controller):

    @http.route(
        '/salesperson_tracking/save_photo',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=False,
    )

    def save_photo(self, **kwargs):
       
        try:
            body      = json.loads(request.httprequest.data or '{}')
            image_data = body.get('image_data', '')
            filename   = body.get('filename') or f'salesperson_photo_{request.env.uid}.jpg'

            if not image_data:
                return {'success': False, 'message': 'No image data received'}

            if ',' in image_data:
                image_b64 = image_data.split(',', 1)[1]
            else:
                image_b64 = image_data

            tracker = request.env['salesperson.tracker'].sudo().search(
                [('user_id', '=', request.env.uid)], limit=1
            )

            print("##############",tracker)

            attachment_vals = {
                'name':         filename,
                'type':         'binary',
                'datas':        image_b64,
                'mimetype':     'image/jpeg',
                'res_model':    'salesperson.tracker',
                'res_id':       tracker.id if tracker else False,
                'description':  f'Salesperson field photo — {request.env.user.name}',
            }

            attachment = request.env['ir.attachment'].sudo().create(attachment_vals)

            return {
                'success':       True,
                'attachment_id': attachment.id,
                'message':       'Photo saved to Odoo',
            }

        except Exception as e:
            return {'success': False, 'message': str(e)}