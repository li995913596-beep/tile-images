<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>瓷砖库存查询系统</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="css/style.css">
</head>

<body>

<h2>库存查询</h2>

<div class="search-bar">
  <input id="searchInput" placeholder="输入编号或色号">
  <button id="btnSearch">查询</button>
  <button onclick="location.reload()">刷新</button>
  <button onclick="location.href='admin.html'">管理员</button>
</div>

<hr>

<div id="result"></div>

<script type="module" src="js/query.js"></script>
</body>
</html>
