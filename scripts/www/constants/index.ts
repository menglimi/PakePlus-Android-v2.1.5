
export const DEFAULT_GARDEN_DATA = {
  "丽都花园": ["金果苑", "金龙苑", "丽雅苑", "丽都别墅", "雍景台", "箐泉雅苑"],
  "丽城花园-新": ["帝城苑", "听涛居", "景湖居"],
  "丽城花园-旧": ["银城苑", "丽城别墅", "龙城苑", "天城苑", "新龙苑"],
  "金凯水都": ["金凯水都", "凯源轩"],
  "世纪康城": ["A区", "B区", "C区"],
  "山水雅居": ["山水雅居"],
  "丽丰花园": ["A区", "B区", "C区", "D区", "E区"],
  "丽景花园": ["绿渟轩", "文华阁", "翠华阁", "怡华阁", "绿湖居", "丽景别墅"]
};

export const MODEL_OPTIONS = {
    deepseek: [
        { value: 'deepseek-chat', label: 'deepseek-chat' },
        { value: 'deepseek-reasoner', label: 'deepseek-reasoner' },
    ],
    gemini: [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (最新/最快)' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (稳定)' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (强推理)' },
    ],
    custom: [] 
};

export const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#f43f5e'];

export const VIDEO_FORMS = [
  { id: 'single_tour', label: "单人带看", desc: "经纪人第一视角带入" },
  { id: 'single_present', label: "单人展示", desc: "经纪人出镜讲解" },
  { id: 'double_agent', label: "双人配合", desc: "2位经纪人互动/问答" },
  { id: 'agent_owner', label: "业主访谈", desc: "经纪人+业主互动" },
  { id: 'drone', label: "无人展示", desc: "纯运镜+画外音+BGM" }
];

export const VIDEO_STYLES = [
  { name: "活泼轻快", desc: "适合年轻客群" },
  { name: "稳重专业", desc: "适合高端改善" },
  { name: "高端商务", desc: "适合豪宅/投资" },
  { name: "流行梗驱动", desc: "抖音快手爆款" },
  { name: "故事驱动", desc: "情感共鸣" }
];

export const VIDEO_DURATIONS = [
  { label: "30秒 (快节奏)", value: "30s" },
  { label: "1分钟 (标准)", value: "1min" },
  { label: "2分钟 (详细)", value: "2min" },
  { label: "3分钟+ (深度沉浸)", value: "3min+" }
];

export const ROOM_PRESETS = {
  'living': ['采光极佳', '开间宽阔', '直通大阳台', '无主灯设计', '满墙电视柜'],
  'bedroom': ['带飘窗', '静谧舒适', '可放1.8米床', '带独立衣帽间', '花园景观'],
  'kitchen': ['U型布局', '洗切炒动线合理', '收纳空间大', '带生活阳台'],
  'bathroom': ['干湿分离', '明卫', '智能马桶', '浴缸'],
  'balcony': ['超大进深', '无遮挡视野', '南北对流', '休闲茶歇区']
};

export const TEMPLATES = [
    { id: 'modern', name: '简约现代', color: '#3b82f6', bg: '#f8fafc', fontColor: '#1e293b' },
    { id: 'urgent', name: '急售爆款', color: '#ef4444', bg: '#fef2f2', fontColor: '#7f1d1d' },
    { id: 'luxury', name: '黑金奢华', color: '#d97706', bg: '#18181b', fontColor: '#fcd34d' },
];

export const TOOLS_DEFINITION = `
You are "MingHui Agent", an intelligent real estate business partner.
You have the ability to execute actions in the database and VISUALIZE data.

AVAILABLE TOOLS:

1. add_property
   - Args: garden, building, room, price, type, layout, area, ownerName, ownerPhone, propertyType

2. update_property
   - Description: Modify an existing property.
   - Args: id (string, required), updates (object containing fields to change e.g. {salePrice: 200, status: 'sold'})

3. add_customer
   - Args: name, phone, type, budgetMin, budgetMax, reqGardens

4. update_customer
   - Description: Modify an existing customer.
   - Args: id (string, required), updates (object containing fields to change e.g. {budgetMax: 500, urgency: 'high'})

5. borrow_key
   - Args: keyNo, borrower, phone, reason

6. return_key
   - Args: keyNo

7. add_followup
   - Args: customerName, content

8. add_todo
   - Args: text, dueDate

9. render_chart
   - Args: title, type, data

10. search_properties
    - Args: keyword, minPrice, maxPrice, rooms, type

11. search_customers
    - Args: keyword

12. search_keys
    - Args: keyword (supports keyNo, garden, room, borrower)

13. add_key
    - Args: keyNo, garden, roomNo

14. add_garden
    - Args: name (string), buildings (optional string array)

15. calculate_mortgage
    - Description: Calculate monthly mortgage payments.
    - Args: loanAmount (number, in Wan), years (number, default 30), rate (number, annual percentage, default 3.25)

PROTOCOL:
1. USE TOOLS whenever possible.
2. Return a VALID JSON object: { "tool": "...", "args": { ... } }
3. If the user asks for a property/customer/key/garden that DOES NOT EXIST (based on your search or context):
   - Do NOT just say it doesn't exist.
   - ASK the user if they want to add it.
   - Example: "未找到相关钥匙。是否需要现在录入？"
4. If the user confirms adding it, use the corresponding add_* tool immediately.
`;
