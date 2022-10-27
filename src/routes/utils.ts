import moment from 'moment';
import fetch from 'node-fetch';

import { getConfig } from '../config/config';
import { OpenHimResponseObject, PostResponseObject, Response } from '../types/response';

const config = getConfig();

export const postData = async (
  host: string,
  port: number | string,
  path: string,
  contentType: string,
  data: string
) : Promise<PostResponseObject> => {
  let body: object = {};
  let status: number = 500;

  try {
    const response = await fetch(`http://${host}:${port}/${path}`, {
      headers: {
        'Content-Type': contentType
      },
      body: data,
      method: 'POST'
    });
    body = await response.json();
    status = response.status;
  } catch (err) {
    if (typeof err === 'string') {
      body = {error: err};
    } else if (err instanceof Error) {
      body = {error: err.message};
    }
    status = 500;
  }

  return {
    status, body
  };
};

