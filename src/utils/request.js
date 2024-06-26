import axios from 'axios';
/* eslint-disable-next-line */
import qs from 'qs';
import { message } from 'ant-design-vue';
import store from '@store';

axios.defaults.withCredentials = true;

const request = axios.create({
  // baseURL: import.meta.env.PROD ? 'http://42.193.126.123:8211' : 'http://localhost:8211',
  baseURL: 'http://42.193.126.123:8211',
  withCredentials: true
});

request.interceptors.request.use((config) => {
  // request 封装request
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  config.headers.token = localStorage.getItem('token');
  if (config.method === 'post') {
    if (config.contentType === 'application/x-www-form-urlencoded') {
      config.headers['content-type'] = 'application/x-www-form-urlencoded';
      config.data = qs.stringify(config.data);
    } else {
      config.headers['content-type'] = 'application/json';
    }
  }
  return config;
}, (error) => {
  // response 错误处理
  message.destroy();
  message.error({
    content: '网络异常',
    duration: 2,
  })
  return Promise.reject(error);
});

// response 拦截
request.interceptors.response.use((response) => {
  // 处理response data
  const res = response.data;
  if (res.code === undefined || res.code !== 200) {
    res.msg = res.msg || res.message || res.errmsg || '服务异常';
    message.destroy();
    message.error({
      content: res.msg,
      duration: 2,
    })
    if (res.code) { handleResponseError(res.code); }
    return Promise.reject(res);
  }
  return res.data !== undefined ? res.data : response;
}, (error) => {
  // response 错误处理
  message.destroy();
  message.error({
    content: '网络异常',
    duration: 4,
  })
  return Promise.reject(error);
});

function handleResponseError(code) {
  switch (code) {
    case 102: // 未登录
      store.commit('changeLoginWindowState', { openLogin: true });
      break;
  }
}

export default request;


// 测试是否是url的正则
export const urlRE = /(https?):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/;
function getURLParam(data) {
  let result = ''
  data.forEach((item) => {
    if (item[0]) {
      result += `&${item[0]}=${item[1]}`
    }
  })

  return result ? '?' + result : ''
}

export function getURL(url) {
  return url.startsWith('http') ? url : 'https://' + url
}

function doRequest(options) {
  const url = getURL(options.url);
  if (url && options.method === 'GET') {
    return request.get(url, getURLParam(options.data));
  } else {
    return request.post(url, getURLParam(options.data));
  }
}
/**
 *
 * @param {object} options 请求的相关参数
 * @param {object} obj 需要修改的数据的父对象
 * @param {string} key 需要修改的数据在父对象中对应的 key
 * @param {string} responseType 需要修改的数据对应的类型
 * @returns {function} 可以取消请求的函数
 */
export function requestWarpper(options, obj, key, responseType = 'object') {
  let count = 0
  let timer = null
  const url = options?.url
  if (url && !/^\d+$/.test(url) || urlRE.test(getURL(url))) {
    if (!options.series) {
      doRequest(options)
        .then((data) => {
          if (responseType === 'object' || responseType === 'array') {
            obj[key] = JSON.parse(data)
          } else {
            obj[key] = data
          }
        })
        .catch((err) => message.error(err?.message || err))
    } else {
      timer = setInterval(() => {
        if (options.requestCount !== 0 && options.requestCount <= count) {
          clearInterval(timer)
          return
        }

        count++
        doRequest(options)
          .then((data) => {
            if (responseType === 'object' || responseType === 'array') {
              obj[key] = JSON.parse(data)
            } else {
              obj[key] = data
            }
          })
          .catch((err) => message.error(err?.message || err))
      }, options.time)
    }
  }

  return function cancelRequest() {
    clearInterval(timer)
  }
}

// 用于重试的代码，getterFn请放入个Promise生成器
/**
 * @param {Number} limit 重试次数
 * @param {Function} getterFn 请求函数，一个promise生成器
 * @param {Function(err)} rejconditionFn 拒绝函数
 * 
 * 示例：const user = await reTryRequest(4, 
        () => request.get(APIS.Switch),
        (err) => {
          const errRes = err.message;
          if(errRes.data && errRes.data.code === 401){
            return true;
          }
          return false;
        } 
      );
 *
*/
export async function reTryRequest(limit, getterFn, rejconditionFn){
  const switchLoader = (onError) => {
    const promise= getterFn();
    return promise.catch((err) => {
      return new Promise((resolve,reject) => {
        const retry = () => resolve(switchLoader(onError));
        const fail = () => reject(err);
        onError(retry, fail, err);
      });
    });
  }

  let timecounter = 0;
  const ans = await switchLoader((retry,fail,err) => {
    if(rejconditionFn(err)){// 如果满足拒绝条件就直接拒绝了
      fail();
    } else {
      // 失败重新发送请求
      if(timecounter < limit){
        timecounter++;
        setTimeout(() => {
          retry();
        },Math.pow(timecounter,2)*500);
      }else {
        fail();
      }
    }
  });
  return ans;
}
