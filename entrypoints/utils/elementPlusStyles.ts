/**
 * Element Plus 样式按需引入。
 *
 * 直接 import 'element-plus/dist/index.css' 会把整份样式表（约 365KB，含
 * el-table / el-date-picker 等本项目根本没用到的组件）打进首屏，且是
 * render-blocking 的，是设置页与侧边栏首次打开慢的主因。
 *
 * 每个 `components/<name>/style/css` 除了自身样式，还会按依赖关系引入
 * base / popper / scrollbar 等前置样式，所以这里只需按“实际用到的组件”
 * 列一遍。新增 Element Plus 组件时，记得在这里补上对应的一行。
 */
import 'element-plus/es/components/base/style/css';
import 'element-plus/es/components/button/style/css';
import 'element-plus/es/components/checkbox/style/css';
import 'element-plus/es/components/col/style/css';
import 'element-plus/es/components/container/style/css';
import 'element-plus/es/components/dialog/style/css';
import 'element-plus/es/components/divider/style/css';
import 'element-plus/es/components/empty/style/css';
import 'element-plus/es/components/footer/style/css';
import 'element-plus/es/components/header/style/css';
import 'element-plus/es/components/icon/style/css';
import 'element-plus/es/components/input/style/css';
import 'element-plus/es/components/input-number/style/css';
import 'element-plus/es/components/link/style/css';
import 'element-plus/es/components/main/style/css';
import 'element-plus/es/components/message/style/css';
// ElMessageBox.confirm 以 JS API 调用，模板里没有 <el-message-box> 标签，
// 只是"扫模板里的 el-* 标签"很容易漏掉这一条。
import 'element-plus/es/components/message-box/style/css';
import 'element-plus/es/components/option/style/css';
import 'element-plus/es/components/option-group/style/css';
import 'element-plus/es/components/row/style/css';
import 'element-plus/es/components/select/style/css';
import 'element-plus/es/components/switch/style/css';
import 'element-plus/es/components/text/style/css';
import 'element-plus/es/components/tooltip/style/css';
