<template>
  <div
    ref="elRef"
    class="shape"
    :class="{ active }"
    @click="selectCurComponent"
    @mousedown="handleMouseDownOnShape"
  >
    <SyncOutlined v-show="isActive" @mousedown="handleRotate" class="icon-xuanzhuan" />
    <span v-show="element.isLock" class="iconfont icon-suo"></span>
    <div
      v-for="item in (isActive? cmp_PointList : [])"
      :key="item"
      class="shape-point"
      :style="getPointStyle(item)"
      @mousedown="handleMouseDownOnPoint(item, $event)"
    >
    </div>
    <slot></slot>
  </div>
</template>

<script setup>
import eventBus from '@utils/eventBus';
import runAnimation from '@utils/runAnimation';
import calculateComponentPositonAndSize from '@utils/calculateComponentPositonAndSize';
import { mod360 } from '@utils/translate';
import { isPreventDrop } from '@utils/utils';
import { computed, onMounted, ref, toRefs, nextTick } from 'vue';
import { SyncOutlined } from '@ant-design/icons-vue';
import { useStore } from 'vuex';

const store = useStore();
const elRef = ref();
const props = defineProps({
  active: {
    type: Boolean,
    default: false,
  },
  element: {
    required: true,
    type: Object,
    default: () => {},
  },
  defaultStyle: {
    required: true,
    type: Object,
    default: () => {},
  },
  index: {
    required: true,
    type: [Number, String],
    default: 0,
  },
})
const {active, element, defaultStyle, index} = toRefs(props);

const curComponent = computed(() => store.state.curComponent);
const editor = computed(() => store.state.compose.editor);

// 两种点阵来适应线/面两种类型的元素
const pointList = ref(['lt', 't', 'rt', 'r', 'rb', 'b', 'lb', 'l']); // 8个方向
const pointList2 = ref(['r', 'l']); // 左右
const initialAngle = ref({ // 每个点对应的初始角度
  lt: 0,
  t: 45,
  rt: 90,
  r: 135,
  rb: 180,
  b: 225,
  lb: 270,
  l: 315,
});
const angleToCursor = ref([ // 每个范围的角度对应的光标
  { start: 338, end: 23, cursor: 'nw' },
  { start: 23, end: 68, cursor: 'n' },
  { start: 68, end: 113, cursor: 'ne' },
  { start: 113, end: 158, cursor: 'e' },
  { start: 158, end: 203, cursor: 'se' },
  { start: 203, end: 248, cursor: 's' },
  { start: 248, end: 293, cursor: 'sw' },
  { start: 293, end: 338, cursor: 'w' },
])
const cursors = ref({});

const cmp_PointList = computed(() => {
  return element.value.component === 'LineShape' ? pointList2.value : pointList.value;
});
const isActive = computed(() => {
  return active.value && !element.value.isLock;
})

onMounted(() => {
  // 用于 Group 组件
  if (curComponent.value) {
    cursors.value = getCursor(); // 根据旋转角度获取光标位置
  }
  eventBus.on('runAnimation', () => {
    if (element.value === curComponent.value) {
      runAnimation(elRef.value, curComponent.value.animations);
    }
  })
  eventBus.on('stopAnimation', () => {
    elRef.value.classList.remove('animated', 'infinite');
  })
})

// 处理旋转
function handleRotate(e) {
  store.commit('setClickComponentStatus', true)
  e.preventDefault();
  e.stopPropagation();
  // 初始坐标和初始角度
  const pos = { ...defaultStyle.value };
  const startY = e.clientY;
  const startX = e.clientX;
  const startRotate = pos.rotate;

  // 获取元素中心点位置
  const rect = elRef.value.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // 旋转前的角度
  const rotateDegreeBefore = Math.atan2(startY - centerY, startX - centerX) / (Math.PI / 180);

  // 如果元素没有移动，则不保存快照
  let hasMove = false;
  const move = (moveEvent) => {
    hasMove = true;
    const curX = moveEvent.clientX;
    const curY = moveEvent.clientY;
    // 旋转后的角度
    const rotateDegreeAfter = Math.atan2(curY - centerY, curX - centerX) / (Math.PI / 180);
    // 获取旋转的角度值
    pos.rotate = startRotate + rotateDegreeAfter - rotateDegreeBefore;
    // 修改当前组件样式
    store.commit('setShapeStyle', pos);
  }

  const up = () => {
    hasMove && store.commit('recordSnapshot');
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    cursors.value = getCursor() // 根据旋转角度获取光标位置
  }

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function getPointStyle(point) {
  const { width, height } = defaultStyle.value;
  const hasT = /t/.test(point);
  const hasB = /b/.test(point);
  const hasL = /l/.test(point);
  const hasR = /r/.test(point);
  let newLeft = 0;
  let newTop = 0;

  // 四个角的点
  if (point.length === 2) {
    newLeft = hasL ? 0 : width;
    newTop = hasT ? 0 : height;
  } else {
    // 上下两点的点，宽度居中
    if (hasT || hasB) {
      newLeft = width / 2;
      newTop = hasT ? 0 : height;
    }

    // 左右两边的点，高度居中
    if (hasL || hasR) {
      newLeft = hasL ? 0 : width;
      newTop = Math.floor(height / 2);
    }
  }

  const style = {
    marginLeft: '-4px',
    marginTop: '-4px',
    left: `${newLeft}px`,
    top: `${newTop}px`,
    cursor: cursors.value[point],
  };

  return style;
}

function getCursor() {
  const rotate = mod360(curComponent.value.style.rotate) // 取余 360
  const result = {}
  let lastMatchIndex = -1 // 从上一个命中的角度的索引开始匹配下一个，降低时间复杂度

  pointList.value.forEach((point) => {
    const angle = mod360(initialAngle.value[point] + rotate);
    const len = angleToCursor.value.length;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      lastMatchIndex = (lastMatchIndex + 1) % len;
      const angleLimit = angleToCursor.value[lastMatchIndex];
      if (angle < 23 || angle >= 338) {
        result[point] = 'nw-resize';
        return;
      }
      if (angleLimit.start <= angle && angle < angleLimit.end) {
        result[point] = angleLimit.cursor + '-resize';
        return;
      }
    }
  })

  return result;
}

function handleMouseDownOnShape(e) {
  // 将当前点击组件的事件传播出去，目前的消费是 VText 组件
  nextTick(() => eventBus.emit('componentClick'));

  store.commit('setInEditorStatus', true);
  store.commit('setClickComponentStatus', true);
  if (isPreventDrop(element.value.component)) {
    e.preventDefault();
  }

  e.stopPropagation();
  store.commit('setCurComponent', { component: element.value, index: index.value });
  if (element.value.isLock) { return; }

  cursors.value = getCursor(); // 根据旋转角度获取光标位置

  const pos = { ...defaultStyle.value };
  const startY = e.clientY;
  const startX = e.clientX;
  // 如果直接修改属性，值的类型会变为字符串，所以要转为数值型
  const startTop = Number(pos.top);
  const startLeft = Number(pos.left);

  // 如果元素没有移动，则不保存快照
  let hasMove = false;
  const move = (moveEvent) => {
    hasMove = true;
    const curX = moveEvent.clientX;
    const curY = moveEvent.clientY;
    pos.top = curY - startY + startTop;
    pos.left = curX - startX + startLeft;

    // 修改当前组件样式
    store.commit('setShapeStyle', pos);
    // 等更新完当前组件的样式并绘制到屏幕后再判断是否需要吸附
    // 如果不使用 $nextTick，吸附后将无法移动
    nextTick(() => {
      // 触发元素移动事件，用于显示标线、吸附功能
      // 后面两个参数代表鼠标移动方向
      // curY - startY > 0 true 表示向下移动 false 表示向上移动
      // curX - startX > 0 true 表示向右移动 false 表示向左移动
      eventBus.emit('move', curY - startY > 0, curX - startX > 0)
    })
  }

  const up = () => {
    hasMove && store.commit('recordSnapshot')
    // 触发元素停止移动事件，用于隐藏标线
    eventBus.emit('unmove')
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

function selectCurComponent(e) {
  // 阻止向父组件冒泡
  e.stopPropagation()
  e.preventDefault()
  store.commit('hideContextMenu')
  // 打开右侧组件列表
  if (!store.state.rightList) {
    store.commit('isShowRightList')
  }
}

function handleMouseDownOnPoint(point, e) {
  store.commit('setInEditorStatus', true)
  store.commit('setClickComponentStatus', true)
  e.stopPropagation()
  e.preventDefault()

  const style = { ...defaultStyle.value }

  // 组件宽高比
  const proportion = style.width / style.height

  // 组件中心点
  const center = {
    x: style.left + style.width / 2,
    y: style.top + style.height / 2,
  }

  // 获取画布位移信息
  const editorRectInfo = editor.value.getBoundingClientRect()

  // 获取 point 与实际拖动基准点的差值 @justJokee
  // fix https://github.com/woai3c/visual-drag-demo/issues/26#issue-937686285 
  const pointRect = e.target.getBoundingClientRect()
  // 当前点击圆点相对于画布的中心坐标
  const curPoint = {
    x: Math.round(pointRect.left - editorRectInfo.left + e.target.offsetWidth / 2),
    y: Math.round(pointRect.top - editorRectInfo.top + e.target.offsetHeight / 2),
  }

  // 获取对称点的坐标
  const symmetricPoint = {
    x: center.x - (curPoint.x - center.x),
    y: center.y - (curPoint.y - center.y),
  }

  // 是否需要保存快照
  let needSave = false;
  let isFirst = true;

  const needLockProportion = isNeedLockProportion();
  const move = (moveEvent) => {
    // 第一次点击时也会触发 move，所以会有“刚点击组件但未移动，组件的大小却改变了”的情况发生
    // 因此第一次点击时不触发 move 事件
    if (isFirst) {
      isFirst = false;
      return;
    }

    needSave = true;
    const curPositon = {
      x: moveEvent.clientX - Math.round(editorRectInfo.left),
      y: moveEvent.clientY - Math.round(editorRectInfo.top),
    }

    calculateComponentPositonAndSize(point, style, curPositon, proportion, needLockProportion, {
      center,
      curPoint,
      symmetricPoint,
    })

    store.commit('setShapeStyle', style)
  }

  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    needSave && store.commit('recordSnapshot')
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

function isNeedLockProportion() {
  if (element.value.component !== 'Group') {return false}
  const ratates = [0, 90, 180, 360];
  for (const component of element.value.propValue) {
    if (!ratates.includes(mod360(parseInt(component.style.rotate)))) {
      return true;
    }
  }
  return false;
}

</script>

<style lang="scss" scoped>
.shape {
  position: absolute;

  &:hover {
    cursor: move;
  }
}

.active {
  outline: 1px solid #70c0ff;
  user-select: none;
}

.shape-point {
  position: absolute;
  background: #fff;
  border: 1px solid #59c7f9;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  z-index: 1;
}

.icon-xuanzhuan {
  position: absolute;
  top: -34px;
  left: 50%;
  transform: translateX(-50%);
  cursor: grab;
  color: #59c7f9;
  font-size: 20px;
  font-weight: 600;

  &:active {
    cursor: grabbing;
  }
}

.icon-suo {
  position: absolute;
  top: 0;
  right: 0;
}
</style>
