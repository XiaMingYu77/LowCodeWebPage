<template>
  <div v-show="menuShow" class="contextmenu" :style="{ top: menuTop + 'px', left: menuLeft + 'px' }">
    <ul @mouseup="handleMouseUp">
      <template v-if="curComponent">
        <template v-if="!curComponent.isLock">
          <li @click="copy">复制</li>
          <li @click="paste">粘贴</li>
          <li @click="cut">剪切</li>
          <li @click="deleteComponent">删除</li>
          <li @click="lock">锁定</li>
          <li @click="topComponent">置顶</li>
          <li @click="bottomComponent">置底</li>
          <li @click="upComponent">上移</li>
          <li @click="downComponent">下移</li>
        </template>
        <li v-else @click="unlock">解锁</li>
      </template>
      <li v-else @click="paste">粘贴</li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

const menuTop = computed(() => store.state.contextmenu.menuTop);
const menuLeft = computed(() => store.state.contextmenu.menuLeft);
const menuShow = computed(() => store.state.contextmenu.menuShow);
const curComponent = computed(() => store.state.curComponent);

function lock() {
  store.commit('lock');
}

function unlock() {
  store.commit('unlock');
}

// 点击菜单时不取消当前组件的选中状态
function handleMouseUp() {
  store.commit('setClickComponentStatus', true)
}
function cut() {
  store.commit('cut')
}
function copy() {
  store.commit('copy')
}
function paste() {
  store.commit('paste', true)
  store.commit('recordSnapshot')
}

function deleteComponent() {
  store.commit('deleteComponent')
  store.commit('recordSnapshot')
}

function upComponent() {
  store.commit('upComponent')
  store.commit('recordSnapshot')
}

function downComponent() {
  store.commit('downComponent')
  store.commit('recordSnapshot')
}

function topComponent() {
  store.commit('topComponent')
  store.commit('recordSnapshot')
}

function bottomComponent() {
  store.commit('bottomComponent')
  store.commit('recordSnapshot')
}
</script>

<style lang="scss" scoped>
.contextmenu {
  position: absolute;
  z-index: 1000;

  ul {
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    background-color: #fff;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, .1);
    box-sizing: border-box;
    margin: 5px 0;
    padding: 6px 0;

    li {
      font-size: 14px;
      padding: 0 20px;
      position: relative;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #606266;
      height: 34px;
      line-height: 34px;
      box-sizing: border-box;
      cursor: pointer;

      &:hover {
        background-color: #f5f7fa;
      }
    }
  }
}
</style>