create：插入一条
createMany：批量插入
findUnique：按唯一键查一条（如 id、唯一索引）
findFirst：按条件查第一条
findMany：按条件查多条
update：更新一条（通常按唯一键）
updateMany：批量更新
upsert：有则更新，无则创建（update + insert 合体）
delete：删除一条
deleteMany：批量删除
count：计数
aggregate：聚合（sum/avg/min/max）
groupBy：分组统计