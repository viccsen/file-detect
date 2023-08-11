#!/usr/bin/env node
/*
 * @Author: Viccsen
 * @Date: 2023-08-11 11:07:23
 * @LastEditTime: 2023-08-11 11:36:42
 * @LastEditors: Viccsen
 * @Description: 
 */

require('../dist/cli')
  .run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
