import { createApp, watchEffect } from 'vue';
import './style.css';
import App from './App.vue';
import '../utils/elementPlusStyles';
import { t } from '../utils/i18n';
import {
    ChatDotRound,
    Setting,
    Refresh,
    Edit,
    Upload,
    Download,
    Star,
    Loading,
    Coffee,
    WarningFilled,
    Warning,
    CircleCheckFilled,
} from '@element-plus/icons-vue';
import {
    ElRow,
    ElCol,
    ElContainer,
    ElHeader,
    ElMain,
    ElFooter,
    ElSelect,
    ElOption,
    ElOptionGroup,
    ElInput,
    ElSwitch,
    ElTooltip,
    ElEmpty,
    ElIcon,
    ElMessage,
    ElLink,
    ElText,
    ElButton,
    ElDialog,
    ElDivider,
    ElInputNumber,
} from 'element-plus';

// 页面标题跟随界面语言（在 mount 前执行，避免先闪出静态标题）
watchEffect(() => {
    document.title = t('app.settingsTitle');
});

const app = createApp(App);

const components = [
    ElRow,
    ElCol,
    ElContainer,
    ElHeader,
    ElMain,
    ElFooter,
    ElSelect,
    ElOption,
    ElOptionGroup,
    ElInput,
    ElSwitch,
    ElTooltip,
    ElEmpty,
    ElIcon,
    ElLink,
    ElText,
    ElButton,
    ElDialog,
    ElDivider,
    ElInputNumber,
];

components.forEach((component) => {
    if (component.name) {
        app.component(component.name, component);
    }
});

app.component('ChatDotRound', ChatDotRound);
app.component('Setting', Setting);
app.component('Refresh', Refresh);
app.component('Edit', Edit);
app.component('Upload', Upload);
app.component('Download', Download);
app.component('Star', Star);
app.component('Loading', Loading);
app.component('Coffee', Coffee);
app.component('WarningFilled', WarningFilled);
app.component('Warning', Warning);
app.component('CircleCheckFilled', CircleCheckFilled);

app.mount('#app');
